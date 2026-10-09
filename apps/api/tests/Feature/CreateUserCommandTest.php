<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateUserCommandTest extends TestCase {
  use RefreshDatabase;

  public function test_creates_user_with_random_email_and_hashed_password(): void {
    $this->artisan('user:create', ['username' => ' newuser '])
      ->expectsQuestion('Пароль (минимум 8 символов)', 'TestPassword123')
      ->expectsQuestion('Повторите пароль', 'TestPassword123')
      ->assertSuccessful();

    $user = User::where('username', 'newuser')->sole();
    $this->assertMatchesRegularExpression('/^[a-f0-9-]{36}@example\.invalid$/', $user->email);
    $this->assertTrue(Hash::check('TestPassword123', $user->password));
    $this->assertNotSame('TestPassword123', $user->password);
    $this->assertSame('newuser', $user->first_name);
  }

  public function test_generates_distinct_emails_for_different_users(): void {
    foreach (['first', 'second'] as $username) {
      $this->artisan('user:create', ['username' => $username])
        ->expectsQuestion('Пароль (минимум 8 символов)', 'TestPassword123')
        ->expectsQuestion('Повторите пароль', 'TestPassword123')
        ->assertSuccessful();
    }

    $this->assertSame(2, User::distinct()->count('email'));
  }

  public function test_rejects_duplicate_username_without_modifying_existing_user(): void {
    $user = User::factory()->create(['username' => 'existing']);
    $before = $user->fresh()->getAttributes();

    $this->artisan('user:create', ['username' => 'existing'])->assertFailed();

    $this->assertDatabaseCount('users', 1);
    $this->assertSame($before, $user->fresh()->getAttributes());
  }

  public function test_rejects_empty_and_overlong_usernames(): void {
    foreach (['   ', str_repeat('a', 256)] as $username) {
      $this->artisan('user:create', ['username' => $username])->assertFailed();
    }

    $this->assertDatabaseCount('users', 0);
  }

  public function test_rejects_short_password(): void {
    $this->artisan('user:create', ['username' => 'newuser'])
      ->expectsQuestion('Пароль (минимум 8 символов)', 'short')
      ->expectsQuestion('Повторите пароль', 'short')
      ->assertFailed();

    $this->assertDatabaseCount('users', 0);
  }

  public function test_rejects_mismatched_password_confirmation(): void {
    $this->artisan('user:create', ['username' => 'newuser'])
      ->expectsQuestion('Пароль (минимум 8 символов)', 'TestPassword123')
      ->expectsQuestion('Повторите пароль', 'DifferentPassword')
      ->assertFailed();

    $this->assertDatabaseCount('users', 0);
  }

  public function test_created_user_can_log_in_by_username(): void {
    $this->artisan('user:create', ['username' => 'newuser'])
      ->expectsQuestion('Пароль (минимум 8 символов)', 'TestPassword123')
      ->expectsQuestion('Повторите пароль', 'TestPassword123')
      ->assertSuccessful();

    $this->postJson('/api/v1/login', [
      'username' => 'newuser',
      'password' => 'TestPassword123',
    ])->assertOk()->assertJsonPath('ok', true)->assertJsonStructure(['token']);
  }
}
