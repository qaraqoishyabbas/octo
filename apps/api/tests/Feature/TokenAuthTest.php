<?php

namespace Tests\Feature;

use App\Contracts\GeoIpResolver;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TokenAuthTest extends TestCase {
  use RefreshDatabase;

  public function test_login_returns_token_and_token_can_access_api(): void {
    $this->app->instance(GeoIpResolver::class, new class implements GeoIpResolver {
      public function lookup(?string $ip): array {
        return [
          'country_code' => 'KZ',
          'country_name' => 'Казахстан',
          'region_code' => 'ALA',
          'region_name' => 'Алматы',
          'city' => 'Алматы',
          'timezone' => 'Asia/Almaty',
          'latitude' => 43.25,
          'longitude' => 76.95,
          'accuracy_radius' => 20,
          'geo_data' => ['source' => 'test'],
        ];
      }
    });

    $user = User::factory()->create([
      'username' => 'token-user',
      'password' => 'password',
    ]);

    $login = $this
      ->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
      ->withHeaders([
        'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ])
      ->postJson('/api/v1/login', [
        'username' => 'token-user',
        'password' => 'password',
      ]);

    $login
      ->assertOk()
      ->assertJson([
        'ok' => true,
      ])
      ->assertJsonStructure([
        'token',
      ]);

    $accessToken = $user->tokens()->first();
    $device = $user->devices()->first();

    $this->assertNotNull($accessToken);
    $this->assertNotSame('web', $accessToken->name);
    $this->assertNotNull($accessToken->expires_at);
    $this->assertFalse(Schema::hasColumn('personal_access_tokens', 'ip'));
    $this->assertNotNull($device);
    $this->assertSame($accessToken->id, $device->personal_access_token_id);
    $this->assertSame('203.0.113.10', $device->ip);
    $this->assertSame('desktop', $device->device_type);
    $this->assertSame('Mac', $device->os_name);
    $this->assertSame('Chrome', $device->client_name);
    $this->assertSame('KZ', $device->country_code);
    $this->assertSame('Алматы', $device->city);

    $this
      ->withToken($login->json('token'))
      ->getJson('/api/v1/me')
      ->assertOk()
      ->assertJsonPath('user.id', $user->id);
  }

  public function test_each_login_creates_a_separate_device_session_without_geoip_data(): void {
    $this->app->instance(GeoIpResolver::class, new class implements GeoIpResolver {
      public function lookup(?string $ip): array {
        return [];
      }
    });

    $user = User::factory()->create([
      'username' => 'multi-session-user',
      'password' => 'password',
    ]);

    foreach (['198.51.100.10', '198.51.100.11'] as $ip) {
      $this
        ->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/login', [
          'username' => 'multi-session-user',
          'password' => 'password',
        ])
        ->assertOk();
    }

    $this->assertCount(2, $user->tokens()->get());
    $this->assertCount(2, $user->devices()->get());
    $this->assertSame(
      ['198.51.100.10', '198.51.100.11'],
      $user->devices()->orderBy('ip')->pluck('ip')->all(),
    );
  }

  public function test_api_rejects_session_auth_without_bearer_token(): void {
    $user = User::factory()->create();

    $this
      ->actingAs($user)
      ->getJson('/api/v1/me')
      ->assertUnauthorized();
  }

  public function test_devices_are_managed_from_access_tokens(): void {
    $user = User::factory()->create();
    $currentToken = $user->createToken('Current device');
    $current = $currentToken->plainTextToken;
    $currentToken->accessToken->device()->create([
      'user_id' => $user->id,
      'ip' => '198.51.100.10',
      'device_type' => 'desktop',
      'os_name' => 'Mac',
      'client_name' => 'Chrome',
    ]);

    $other = $user->createToken('Other device')->accessToken;
    $otherDeviceRecord = $other->device()->create([
      'user_id' => $user->id,
      'ip' => '198.51.100.20',
      'device_type' => 'smartphone',
      'device_brand' => 'Apple',
      'device_model' => 'iPhone',
      'os_name' => 'iOS',
      'os_version' => '18.0',
      'client_type' => 'browser',
      'client_name' => 'Mobile Safari',
      'client_version' => '18.0',
      'client_engine' => 'WebKit',
      'country_code' => 'KZ',
      'country_name' => 'Казахстан',
      'region_name' => 'Алматы',
      'city' => 'Алматы',
      'timezone' => 'Asia/Almaty',
      'latitude' => 43.25,
      'longitude' => 76.95,
      'accuracy_radius' => 20,
    ]);

    $devices = $this
      ->withToken($current)
      ->getJson('/api/v1/devices')
      ->assertOk()
      ->json('devices');

    $otherDevice = collect($devices)->firstWhere('name', 'Other device');

    $this->assertNotNull($otherDevice);
    $this->assertSame('198.51.100.20', $otherDevice['ip']);
    $this->assertFalse($otherDevice['is_bot']);
    $this->assertSame('smartphone', $otherDevice['device']['type']);
    $this->assertSame('iPhone', $otherDevice['device']['model']);
    $this->assertSame('iOS', $otherDevice['os']['name']);
    $this->assertSame('Mobile Safari', $otherDevice['client']['name']);
    $this->assertSame('KZ', $otherDevice['location']['country_code']);
    $this->assertSame('Алматы', $otherDevice['location']['city']);
    $this->assertSame($other->id, Crypt::decryptString($otherDevice['key']));

    $this
      ->withToken($current)
      ->deleteJson('/api/v1/devices/' . $otherDevice['key'])
      ->assertOk();

    $this->assertDatabaseMissing('personal_access_tokens', [
      'id' => $other->id,
    ]);
    $this->assertDatabaseMissing('devices', [
      'id' => $otherDeviceRecord->id,
    ]);
  }

  public function test_destroy_other_devices_keeps_current_token(): void {
    $user = User::factory()->create();
    $current = $user->createToken('Current device');
    $other = $user->createToken('Other device')->accessToken;
    $currentDevice = $current->accessToken->device()->create(['user_id' => $user->id]);
    $otherDevice = $other->device()->create(['user_id' => $user->id]);

    $this
      ->withToken($current->plainTextToken)
      ->deleteJson('/api/v1/devices')
      ->assertOk();

    $this->assertDatabaseHas('personal_access_tokens', [
      'id' => $current->accessToken->id,
    ]);
    $this->assertDatabaseHas('devices', [
      'id' => $currentDevice->id,
    ]);
    $this->assertDatabaseMissing('personal_access_tokens', [
      'id' => $other->id,
    ]);
    $this->assertDatabaseMissing('devices', [
      'id' => $otherDevice->id,
    ]);
  }

  public function test_user_cannot_disconnect_another_users_device(): void {
    $user = User::factory()->create();
    $current = $user->createToken('Current device')->plainTextToken;

    $otherUser = User::factory()->create();
    $foreignToken = $otherUser->createToken('Foreign device')->accessToken;
    $foreignDevice = $foreignToken->device()->create(['user_id' => $otherUser->id]);

    $this
      ->withToken($current)
      ->deleteJson('/api/v1/devices/' . Crypt::encryptString($foreignToken->id))
      ->assertOk();

    $this->assertDatabaseHas('personal_access_tokens', ['id' => $foreignToken->id]);
    $this->assertDatabaseHas('devices', ['id' => $foreignDevice->id]);
  }
}
