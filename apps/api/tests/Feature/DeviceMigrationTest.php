<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeviceMigrationTest extends TestCase {
  use RefreshDatabase;

  public function test_existing_tokens_are_moved_to_devices_and_token_ip_is_removed(): void {
    $migration = require database_path('migrations/2026_09_20_000001_create_devices_table.php');
    $migration->down();

    $user = User::factory()->create();
    $token = $user->createToken('Legacy device')->accessToken;

    DB::table('personal_access_tokens')
      ->where('id', $token->id)
      ->update(['ip' => '203.0.113.20']);

    $migration->up();

    $this->assertFalse(Schema::hasColumn('personal_access_tokens', 'ip'));
    $this->assertDatabaseHas('devices', [
      'user_id' => $user->id,
      'personal_access_token_id' => $token->id,
      'ip' => '203.0.113.20',
    ]);

    DB::table('personal_access_tokens')->where('id', $token->id)->delete();

    $this->assertDatabaseMissing('devices', [
      'personal_access_token_id' => $token->id,
    ]);
  }
}
