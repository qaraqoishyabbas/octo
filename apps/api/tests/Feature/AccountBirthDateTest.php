<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountBirthDateTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_update_birth_date(): void {
    $user = User::factory()->create();
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->postJson('/api/v1/account/birth-date', [
        'birth_date' => '2000-05-20',
      ])
      ->assertOk()
      ->assertJson([
        'ok' => true,
      ]);

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'birth_date' => '2000-05-20',
    ]);
  }

  public function test_birth_date_must_be_valid_date(): void {
    $user = User::factory()->create([
      'birth_date' => '2000-05-20',
    ]);
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->postJson('/api/v1/account/birth-date', [
        'birth_date' => 'tomorrow',
      ])
      ->assertUnprocessable()
      ->assertJsonFragment([
        'name' => 'birth_date',
      ]);

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'birth_date' => '2000-05-20',
    ]);
  }

  public function test_user_can_clear_birth_date(): void {
    $user = User::factory()->create([
      'birth_date' => '2000-05-20',
    ]);
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->postJson('/api/v1/account/birth-date', [
        'birth_date' => null,
      ])
      ->assertOk()
      ->assertJson([
        'ok' => true,
      ]);

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'birth_date' => null,
    ]);
  }
}
