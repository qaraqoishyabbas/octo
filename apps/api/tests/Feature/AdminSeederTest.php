<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminSeederTest extends TestCase {
  use RefreshDatabase;

  public function test_seeder_creates_admin_who_can_login_by_username(): void {
    $this->seed(DatabaseSeeder::class);

    $admin = User::where('username', 'admin')->sole();
    $this->assertTrue(Hash::check('password', $admin->password));
    $this->assertMatchesRegularExpression('/^[a-f0-9-]{36}@example\.invalid$/', $admin->email);
    $this->assertDatabaseCount('users', 1);

    $this->post('/login', ['username' => 'admin', 'password' => 'password'])
      ->assertSessionHasNoErrors()
      ->assertRedirect('/dashboard');
    $this->assertAuthenticatedAs($admin);
  }

  public function test_reseeding_preserves_existing_admin_credentials(): void {
    $admin = User::factory()->create(['username' => 'admin', 'password' => 'changed-password']);
    $before = $admin->fresh()->getAttributes();

    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    $this->assertDatabaseCount('users', 1);
    $this->assertSame($before, $admin->fresh()->getAttributes());
  }

  public function test_incorrect_password_does_not_authenticate_admin(): void {
    $this->seed(DatabaseSeeder::class);
    $this->post('/login', ['username' => 'admin', 'password' => 'wrong-password'])
      ->assertSessionHasErrors('username');
    $this->assertGuest();
  }

  public function test_admin_can_register_user_without_email(): void {
    $this->actingAs(User::factory()->create());
    $this->get('/users/create')->assertOk();
    $this->post('/users', [
      'username' => 'alice',
      'password' => 'secret-password',
      'password_confirmation' => 'secret-password',
    ])->assertSessionHasNoErrors()->assertRedirect();

    $user = User::where('username', 'alice')->sole();
    $this->assertMatchesRegularExpression('/^[a-f0-9-]{36}@example\.invalid$/', $user->email);
    $this->assertTrue(Hash::check('secret-password', $user->password));
  }

  public function test_registration_requires_matching_passwords_and_authentication(): void {
    $this->get('/users/create')->assertRedirect('/login');
    $this->post('/users', ['username' => 'alice', 'password' => 'secret-password'])
      ->assertRedirect('/login');
    $this->assertDatabaseCount('users', 0);

    $this->actingAs(User::factory()->create());
    $this->post('/users', [
      'username' => 'alice',
      'password' => 'secret-password',
      'password_confirmation' => 'different-password',
    ])->assertSessionHasErrors('password');
    $this->assertDatabaseCount('users', 1);
  }
}
