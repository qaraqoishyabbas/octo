<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountUsernameTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_update_username(): void {
    $user = User::factory()->create([
      'username' => 'old-name',
    ]);
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->postJson('/api/v1/account/username', [
        'username' => 'New.Name_123',
      ])
      ->assertOk()
      ->assertJson([
        'ok' => true,
      ]);

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'username' => 'new.name_123',
    ]);
  }

  public function test_username_rejects_invalid_characters(): void {
    $user = User::factory()->create([
      'username' => 'valid-name',
    ]);
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->postJson('/api/v1/account/username', [
        'username' => 'bad name!',
      ])
      ->assertUnprocessable()
      ->assertJsonFragment([
        'name' => 'username',
      ]);

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'username' => 'valid-name',
    ]);
  }

  public function test_username_must_be_unique(): void {
    User::factory()->create([
      'username' => 'taken-name',
    ]);
    $user = User::factory()->create([
      'username' => 'free-name',
    ]);
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->postJson('/api/v1/account/username', [
        'username' => 'taken-name',
      ])
      ->assertUnprocessable()
      ->assertJsonFragment([
        'name' => 'username',
      ]);

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'username' => 'free-name',
    ]);
  }
}
