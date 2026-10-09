<?php

namespace Tests\Feature;

use App\Models\NotificationApp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Minishlink\WebPush\VAPID;
use Tests\TestCase;

class AdminNotificationAppTest extends TestCase {
  use RefreshDatabase;

  public function test_guest_cannot_open_notification_app_admin(): void {
    $this->get('/notification-apps')->assertRedirect('/login');
  }

  public function test_admin_generates_valid_vapid_keys_and_can_save_them(): void {
    $admin = User::factory()->create();
    $app = NotificationApp::create(['owner_id' => $admin->id, 'name' => 'Web', 'platform' => 'web']);
    $this->actingAs($admin);

    $response = $this->postJson("/notification-apps/{$app->id}/vapid-keys")
      ->assertOk()->assertJsonStructure(['public_key', 'private_key']);
    $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    $keys = $response->json();
    $validated = VAPID::validate([
      'subject' => 'mailto:admin@example.com',
      'publicKey' => $keys['public_key'],
      'privateKey' => $keys['private_key'],
    ]);
    $this->assertSame(65, strlen($validated['publicKey']));
    $this->assertSame(32, strlen($validated['privateKey']));
    $this->assertDatabaseCount('notification_credentials', 0);

    $this->put("/notification-apps/{$app->id}/credentials/webpush", [
      'subject' => 'mailto:admin@example.com', ...$keys,
    ])->assertSessionHasNoErrors()->assertRedirect();
    $this->assertSame($keys['private_key'], $app->credentials()->sole()->credentials['private_key']);
    $raw = DB::table('notification_credentials')->value('credentials');
    $this->assertStringNotContainsString($keys['private_key'], $raw);
    $this->get('/notification-apps')->assertOk()->assertDontSee($keys['private_key']);
  }

  public function test_generation_does_not_replace_existing_keys_and_returns_fresh_pair(): void {
    $admin = User::factory()->create();
    $app = NotificationApp::create(['owner_id' => $admin->id, 'name' => 'Desktop', 'platform' => 'desktopapp']);
    $credential = $app->credentials()->create([
      'provider' => 'webpush',
      'credentials' => ['subject' => 'mailto:admin@example.com', 'public_key' => 'old-public', 'private_key' => 'old-private'],
    ]);
    $before = $credential->credentials;
    $this->actingAs($admin);

    $first = $this->postJson("/notification-apps/{$app->id}/vapid-keys")->assertOk()->json();
    $second = $this->postJson("/notification-apps/{$app->id}/vapid-keys")->assertOk()->json();

    $this->assertNotSame($first['public_key'], $second['public_key']);
    $this->assertNotSame($first['private_key'], $second['private_key']);
    $this->assertSame($before, $credential->fresh()->credentials);
  }

  public function test_guest_cannot_generate_vapid_keys(): void {
    $app = NotificationApp::create(['owner_id' => User::factory()->create()->id, 'name' => 'Web', 'platform' => 'web']);
    $this->post("/notification-apps/{$app->id}/vapid-keys")->assertRedirect('/login');
    $this->assertDatabaseCount('notification_credentials', 0);
  }

  public function test_vapid_generation_rejects_non_webpush_platforms(): void {
    $admin = User::factory()->create();
    $this->actingAs($admin);
    foreach (['android', 'ios'] as $platform) {
      $app = NotificationApp::create(['owner_id' => $admin->id, 'name' => $platform, 'platform' => $platform]);
      $this->postJson("/notification-apps/{$app->id}/vapid-keys")
        ->assertUnprocessable()->assertJsonValidationErrors('provider');
    }
  }

  public function test_admin_creates_application_from_web_form(): void {
    $admin = User::factory()->create();
    $this->actingAs($admin);

    $this->post('/notification-apps', [
      'name' => 'Octo Web',
      'platform' => 'web',
    ])->assertRedirect('/notification-apps');

    $this->assertDatabaseHas('notification_apps', [
      'owner_id' => $admin->id,
      'name' => 'Octo Web',
      'platform' => 'web',
    ]);
    $this->get('/notification-apps')->assertOk()->assertSee('Octo Web');
  }

  public function test_admin_can_save_credentials_without_exposing_private_key_on_page(): void {
    $admin = User::factory()->create();
    $app = NotificationApp::query()->create([
      'owner_id' => $admin->id,
      'name' => 'Octo Web',
      'platform' => 'web',
    ]);
    $this->actingAs($admin);

    $this->put("/notification-apps/{$app->id}/credentials/webpush", [
      'subject' => 'mailto:admin@example.com',
      'public_key' => 'public-key',
      'private_key' => 'very-secret-key',
    ])->assertRedirect();

    $raw = DB::table('notification_credentials')->where('notification_app_id', $app->id)->value('credentials');
    $this->assertStringNotContainsString('very-secret-key', $raw);
    $this->get('/notification-apps')->assertOk()->assertDontSee('very-secret-key');
  }

  public function test_admin_rejects_provider_for_wrong_platform_and_can_disable_app(): void {
    $admin = User::factory()->create();
    $app = NotificationApp::query()->create([
      'owner_id' => $admin->id,
      'name' => 'Android',
      'platform' => 'android',
    ]);
    $this->actingAs($admin);

    $this->put("/notification-apps/{$app->id}/credentials/webpush", [
      'subject' => 'mailto:admin@example.com',
      'public_key' => 'public-key',
      'private_key' => 'secret',
    ])->assertSessionHasErrors('provider');

    $this->patch("/notification-apps/{$app->id}", ['enabled' => false])
      ->assertRedirect();
    $this->assertDatabaseHas('notification_apps', ['id' => $app->id, 'enabled' => false]);
  }

  public function test_admin_can_remove_credentials_and_application(): void {
    $admin = User::factory()->create();
    $app = NotificationApp::query()->create([
      'owner_id' => $admin->id,
      'name' => 'Octo Web',
      'platform' => 'web',
    ]);
    $app->credentials()->create([
      'provider' => 'webpush',
      'credentials' => ['subject' => 'mailto:admin@example.com', 'public_key' => 'public', 'private_key' => 'secret'],
    ]);
    $this->actingAs($admin);

    $this->delete("/notification-apps/{$app->id}/credentials/webpush")->assertRedirect();
    $this->assertDatabaseMissing('notification_credentials', ['notification_app_id' => $app->id]);
    $this->delete("/notification-apps/{$app->id}")->assertRedirect('/notification-apps');
    $this->assertDatabaseMissing('notification_apps', ['id' => $app->id]);
  }
}
