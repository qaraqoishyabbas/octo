<?php

namespace Tests\Feature;

use App\Models\NotificationApp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminNotificationAppTest extends TestCase {
  use RefreshDatabase;

  public function test_guest_cannot_open_notification_app_admin(): void {
    $this->get('/notification-apps')->assertRedirect('/login');
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
