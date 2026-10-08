<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Http;
use App\Jobs\SendPushNotification;
use App\Services\PushProvider;
use App\Models\NotificationPreference;
use App\Models\Dialog;
use App\Enums\DialogType;
use Tests\TestCase;

class NotificationServiceTest extends TestCase {
  use RefreshDatabase;

  public function test_owner_creates_an_application_and_other_users_cannot_manage_it(): void {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    $response = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Octo Web', 'platform' => 'web']);

    $response->assertCreated()->assertJsonPath('data.platform', 'web');
    $id = $response->json('data.id');

    $this->app['auth']->forgetGuards();
    $this->withToken($other->createToken('other')->plainTextToken)
      ->putJson("/api/v1/notification-apps/{$id}/credentials", ['provider' => 'webpush', 'credentials' => ['public_key' => 'x']])
      ->assertNotFound();
  }

  public function test_credentials_are_encrypted_and_never_returned_from_read_api(): void {
    $owner = User::factory()->create();
    $this->withToken($owner->createToken('owner')->plainTextToken);
    $id = $this->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');

    $this->putJson("/api/v1/notification-apps/{$id}/credentials", [
      'provider' => 'fcm',
      'credentials' => ['project_id' => 'demo', 'client_email' => 'bot@example.com', 'private_key' => 'top-secret'],
    ])->assertOk()->assertJsonMissing(['top-secret']);

    $raw = DB::table('notification_credentials')->where('notification_app_id', $id)->value('credentials');
    $this->assertStringNotContainsString('top-secret', $raw);
    $this->getJson("/api/v1/notification-apps/{$id}")->assertOk()->assertJsonMissing(['top-secret']);
  }

  public function test_authenticated_user_can_register_rotate_and_remove_own_push_token(): void {
    $owner = User::factory()->create();
    $user = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');

    $this->withToken($user->createToken('user')->plainTextToken);
    $first = $this->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'device-token-1']);
    $first->assertCreated();
    $id = $first->json('data.id');
    $this->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'device-token-1'])
      ->assertOk()->assertJsonPath('data.id', $id);
    $this->assertSame(1, DB::table('push_tokens')->count());

    $this->deleteJson("/api/v1/push-tokens/{$id}")->assertOk();
    $this->assertSame(0, DB::table('push_tokens')->count());
  }

  public function test_sender_cannot_target_a_user_without_a_token_in_the_app(): void {
    $owner = User::factory()->create();
    $target = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');

    $this->postJson("/api/v1/notification-apps/{$appId}/notifications", [
      'user_ids' => [$target->id], 'title' => 'Hello', 'body' => 'World',
    ])->assertCreated()->assertJsonPath('data.queued', 0);
  }

  public function test_sending_creates_queued_delivery_for_registered_user_only(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $target = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($target->createToken('target')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'fcm-token'])->assertCreated();
    $this->app['auth']->forgetGuards();
    $this->withToken($owner->createToken('owner-2')->plainTextToken)
      ->postJson("/api/v1/notification-apps/{$appId}/notifications", [
        'user_ids' => [$target->id], 'title' => 'Hello', 'body' => 'World',
      ])->assertCreated()->assertJsonPath('data.queued', 1);

    $this->assertDatabaseHas('notification_deliveries', ['user_id' => $target->id, 'status' => 'queued']);
    Queue::assertPushed(SendPushNotification::class, 1);
  }

  public function test_message_push_respects_mute_and_mention_exception(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $sender = User::factory()->create();
    $recipient = User::factory()->create(['username' => 'recipient']);
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($recipient->createToken('recipient')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'fcm-token'])->assertCreated();
    $dialog = Dialog::factory()->create(['type' => DialogType::GROUP]);
    $dialog->users()->sync([
      $sender->id => ['muted' => false],
      $recipient->id => ['muted' => true],
    ]);
    $this->app['auth']->forgetGuards();
    $this->withToken($sender->createToken('sender')->plainTextToken)
      ->postJson('/api/v1/messages', ['dialog_id' => $dialog->dialog_id, 'message' => 'Hello'])
      ->assertCreated();
    $this->assertSame(0, DB::table('notification_deliveries')->count());

    $mention = '<p>Hi <span data-type="mention" data-id="' . $recipient->id . '" data-label="recipient">recipient</span></p>';
    $this->postJson('/api/v1/messages', ['dialog_id' => $dialog->dialog_id, 'message' => $mention])
      ->assertCreated();
    $this->assertSame(1, DB::table('notification_deliveries')->count());

    NotificationPreference::query()->create(['user_id' => $recipient->id, 'enabled' => false]);
    $this->postJson('/api/v1/messages', ['dialog_id' => $dialog->dialog_id, 'message' => $mention])
      ->assertCreated();
    $this->assertSame(1, DB::table('notification_deliveries')->count());
  }

  public function test_user_can_disable_push_and_sound(): void {
    $user = User::factory()->create();
    $this->withToken($user->createToken('settings')->plainTextToken)
      ->getJson('/api/v1/notification-preferences')
      ->assertOk()->assertJsonPath('data.enabled', true)->assertJsonPath('data.badge', true);
    $this->withToken($user->createToken('settings')->plainTextToken)
      ->patchJson('/api/v1/notification-preferences', [
        'enabled' => false, 'sound' => false, 'mentions_in_muted' => false,
      ])->assertOk()->assertJsonPath('data.enabled', false)->assertJsonPath('data.sound', false);
    $this->getJson('/api/v1/notification-preferences')
      ->assertOk()->assertJsonPath('data.mentions_in_muted', false);
  }

  public function test_user_can_hide_notification_text_and_names(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $recipient = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($recipient->createToken('recipient')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'device-token'])->assertCreated();
    $this->patchJson('/api/v1/notification-preferences', [
      'show_text' => false, 'show_names' => false,
    ])->assertOk()->assertJsonPath('data.show_text', false)->assertJsonPath('data.show_names', false);

    $this->app['auth']->forgetGuards();
    $this->withToken($owner->createToken('owner-2')->plainTextToken)
      ->postJson("/api/v1/notification-apps/{$appId}/notifications", [
        'user_ids' => [$recipient->id], 'title' => 'Alice', 'body' => 'Secret text',
      ])->assertCreated()->assertJsonPath('data.queued', 1);

    $this->assertDatabaseHas('notification_deliveries', [
      'user_id' => $recipient->id,
      'title' => 'Новое уведомление',
      'body' => 'Содержимое скрыто',
    ]);
  }

  public function test_web_push_uses_client_settings_even_when_legacy_server_preferences_disable_delivery(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Web', 'platform' => 'web'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($recipient->createToken('recipient')->plainTextToken)
      ->postJson('/api/v1/push-tokens', [
        'app_id' => $appId,
        'token' => json_encode([
          'endpoint' => 'https://fcm.googleapis.com/fcm/send/example',
          'keys' => ['p256dh' => 'public', 'auth' => 'secret'],
        ]),
      ])->assertCreated();
    NotificationPreference::query()->create([
      'user_id' => $recipient->id,
      'enabled' => false,
      'show_text' => false,
      'show_names' => false,
    ]);
    $dialog = Dialog::factory()->create(['type' => DialogType::GROUP, 'title' => 'Project']);
    $dialog->users()->sync([
      $sender->id => ['muted' => false],
      $recipient->id => ['muted' => true],
    ]);

    $this->app['auth']->forgetGuards();
    $this->withToken($sender->createToken('sender')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => '<span data-id="' . $recipient->id . '">Secret</span>',
      ])
      ->assertCreated();

    $delivery = DB::table('notification_deliveries')->where('user_id', $recipient->id)->first();
    $this->assertNotNull($delivery);
    $this->assertSame('Project', $delivery->title);
    $this->assertSame('Secret', $delivery->body);
    $this->assertTrue((bool)json_decode($delivery->data, true)['muted']);
    $this->assertTrue((bool)json_decode($delivery->data, true)['mentioned']);

    $this->postJson('/api/v1/messages', ['dialog_id' => $dialog->dialog_id, 'message' => 'Unmentioned'])
      ->assertCreated();
    $this->assertSame(1, DB::table('notification_deliveries')->count());
  }

  public function test_web_app_exposes_only_public_vapid_key_to_authenticated_user(): void {
    $owner = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Web', 'platform' => 'web'])->json('data.id');
    $this->putJson("/api/v1/notification-apps/{$appId}/credentials", [
      'provider' => 'webpush',
      'credentials' => ['subject' => 'mailto:push@example.com', 'public_key' => 'public-key', 'private_key' => 'private-key'],
    ])->assertOk();
    $this->getJson("/api/v1/notification-apps/{$appId}/public-config")
      ->assertOk()->assertJsonPath('data.public_key', 'public-key')->assertJsonMissing(['private-key']);
  }

  public function test_message_accepts_silent_flag(): void {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $dialog = Dialog::factory()->create(['type' => DialogType::DIRECT]);
    $dialog->users()->sync([$sender->id, $recipient->id]);
    $this->withToken($sender->createToken('sender')->plainTextToken)
      ->postJson('/api/v1/messages', ['dialog_id' => $dialog->dialog_id, 'message' => 'Quiet', 'silent' => true])
      ->assertCreated()->assertJsonPath('data.silent', true);
  }

  public function test_fcm_delivery_updates_status_after_provider_accepts(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $target = User::factory()->create();
    $key = openssl_pkey_new(['private_key_bits' => 2048]);
    openssl_pkey_export($key, $privateKey);
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $this->putJson("/api/v1/notification-apps/{$appId}/credentials", [
      'provider' => 'fcm',
      'credentials' => ['project_id' => 'demo-project', 'client_email' => 'bot@example.com', 'private_key' => $privateKey],
    ])->assertOk();
    $this->app['auth']->forgetGuards();
    $this->withToken($target->createToken('target')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'device-token'])->assertCreated();
    $this->app['auth']->forgetGuards();
    $this->withToken($owner->createToken('owner2')->plainTextToken)
      ->postJson("/api/v1/notification-apps/{$appId}/notifications", [
        'user_ids' => [$target->id], 'title' => 'Hello', 'body' => 'World',
      ])->assertCreated();

    Http::fake([
      'oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
      'fcm.googleapis.com/*' => Http::response(['name' => 'projects/demo/messages/1']),
    ]);
    $id = DB::table('notification_deliveries')->value('id');
    (new SendPushNotification($id))->handle(app(PushProvider::class));
    $this->assertDatabaseHas('notification_deliveries', ['id' => $id, 'status' => 'sent']);
    Http::assertSent(fn($request) => str_contains($request->url(), 'messages:send')
      && $request['message']['token'] === 'device-token');
  }

  public function test_ios_registration_selects_its_provider(): void {
    $owner = User::factory()->create();
    $user = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'iOS', 'platform' => 'ios'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($user->createToken('ios')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'provider' => 'fcm', 'token' => 'ios-fcm-token'])
      ->assertCreated()->assertJsonPath('data.provider', 'fcm');
  }

  public function test_push_registration_is_removed_when_login_session_is_deleted(): void {
    $owner = User::factory()->create();
    $user = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $session = $user->createToken('phone');
    $this->app['auth']->forgetGuards();
    $this->withToken($session->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'fcm-token'])
      ->assertCreated();
    $session->accessToken->delete();
    $this->assertSame(0, DB::table('push_tokens')->count());
  }

  public function test_apns_delivery_sends_alert_with_signed_token(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $target = User::factory()->create();
    $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    openssl_pkey_export($key, $privateKey);
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'iOS', 'platform' => 'ios'])->json('data.id');
    $this->putJson("/api/v1/notification-apps/{$appId}/credentials", [
      'provider' => 'apns',
      'credentials' => [
        'team_id' => 'TEAM', 'key_id' => 'KEY', 'bundle_id' => 'com.example.app', 'private_key' => $privateKey,
      ],
    ])->assertOk();
    $this->app['auth']->forgetGuards();
    $this->withToken($target->createToken('target')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'device-token'])->assertCreated();
    $this->app['auth']->forgetGuards();
    $this->withToken($owner->createToken('owner2')->plainTextToken)
      ->postJson("/api/v1/notification-apps/{$appId}/notifications", [
        'user_ids' => [$target->id], 'title' => 'Hello', 'body' => 'World',
      ])->assertCreated();
    Http::fake(['api.push.apple.com/*' => Http::response([], 200)]);
    $id = DB::table('notification_deliveries')->value('id');
    (new SendPushNotification($id))->handle(app(PushProvider::class));
    $this->assertDatabaseHas('notification_deliveries', ['id' => $id, 'status' => 'sent']);
    Http::assertSent(fn($request) => str_contains($request->url(), '/3/device/device-token')
      && $request['aps']['alert']['title'] === 'Hello');
  }

  public function test_missing_credentials_do_not_break_message_send_in_sync_queue(): void {
    $owner = User::factory()->create();
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($recipient->createToken('recipient')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'fcm-token'])->assertCreated();
    $dialog = Dialog::factory()->create(['type' => DialogType::DIRECT]);
    $dialog->users()->sync([$sender->id, $recipient->id]);
    $this->app['auth']->forgetGuards();
    $this->withToken($sender->createToken('sender')->plainTextToken)
      ->postJson('/api/v1/messages', ['dialog_id' => $dialog->dialog_id, 'message' => 'Hello'])
      ->assertCreated();
    $this->assertDatabaseHas('notification_deliveries', ['user_id' => $recipient->id, 'status' => 'failed']);
  }

  public function test_opt_out_applies_to_manual_send_and_sound_preference_to_payload(): void {
    Queue::fake();
    $owner = User::factory()->create();
    $target = User::factory()->create();
    $appId = $this->withToken($owner->createToken('owner')->plainTextToken)
      ->postJson('/api/v1/notification-apps', ['name' => 'Android', 'platform' => 'android'])->json('data.id');
    $this->app['auth']->forgetGuards();
    $this->withToken($target->createToken('target')->plainTextToken)
      ->postJson('/api/v1/push-tokens', ['app_id' => $appId, 'token' => 'fcm-token'])->assertCreated();
    NotificationPreference::query()->create(['user_id' => $target->id, 'enabled' => false]);
    $this->app['auth']->forgetGuards();
    $this->withToken($owner->createToken('owner2')->plainTextToken)
      ->postJson("/api/v1/notification-apps/{$appId}/notifications", [
        'user_ids' => [$target->id], 'title' => 'Hello', 'body' => 'World',
      ])->assertCreated()->assertJsonPath('data.queued', 0);

    NotificationPreference::query()->where('user_id', $target->id)->update(['enabled' => true, 'sound' => false]);
    $this->postJson("/api/v1/notification-apps/{$appId}/notifications", [
      'user_ids' => [$target->id], 'title' => 'Hello', 'body' => 'World',
    ])->assertCreated()->assertJsonPath('data.queued', 1);
    $data = json_decode(DB::table('notification_deliveries')->value('data'), true);
    $this->assertTrue($data['silent']);
  }
}
