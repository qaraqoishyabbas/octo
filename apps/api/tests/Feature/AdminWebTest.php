<?php

namespace Tests\Feature;

use App\Models\User;
use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminWebTest extends TestCase {
  use RefreshDatabase;

  public function test_admin_can_login_and_open_dashboard(): void {
    User::factory()->create([
      'email' => 'admin@example.com',
      'password' => 'password',
    ]);

    $this
      ->post('/login', [
        'email' => 'admin@example.com',
        'password' => 'password',
      ])
      ->assertRedirect('/dashboard');

    $this
      ->get('/dashboard')
      ->assertOk();
  }

  public function test_authenticated_admin_can_manage_users(): void {
    $admin = User::factory()->create();

    $this->actingAs($admin);

    $this
      ->post('/users', [
        'first_name' => 'New',
        'last_name' => 'User',
        'username' => 'new-user',
        'email' => 'new@example.com',
        'password' => 'secret-password',
      ])
      ->assertRedirect();

    $user = User::query()->where('email', 'new@example.com')->firstOrFail();

    $this->assertTrue(Hash::check('secret-password', $user->password));

    $this
      ->put("/users/{$user->id}", [
        'first_name' => 'Edited',
        'last_name' => 'User',
        'username' => 'edited-user',
        'email' => 'edited@example.com',
        'bio' => 'Managed from admin.',
        'password' => '',
      ])
      ->assertRedirect();

    $this->assertDatabaseHas('users', [
      'id' => $user->id,
      'first_name' => 'Edited',
      'email' => 'edited@example.com',
      'bio' => 'Managed from admin.',
    ]);

    $this
      ->delete("/users/{$user->id}")
      ->assertRedirect();

    $this->assertDatabaseMissing('users', [
      'id' => $user->id,
    ]);
  }

  public function test_authenticated_admin_can_manage_channels_and_owners(): void {
    $admin = User::factory()->create();
    $owner = User::factory()->create();
    $newOwner = User::factory()->create();

    $this->actingAs($admin);

    $this->get('/channels')->assertOk();

    $this
      ->post('/dialogs/' . DialogType::CHANNEL->value, [
        'title' => 'Release notes',
        'description' => 'Broadcast product updates.',
        'owner_id' => $owner->id,
      ])
      ->assertRedirect();

    $channel = Dialog::query()->where('title', 'Release notes')->firstOrFail();

    $this->assertSame(DialogType::CHANNEL, $channel->type);
    $this->assertSame($owner->id, $channel->author_id);
    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $channel->id,
      'user_id' => $owner->id,
      'role' => DialogMemberRole::OWNER->value,
    ]);

    $this
      ->put("/dialogs/{$channel->id}/owner", [
        'owner_id' => $newOwner->id,
      ])
      ->assertRedirect();

    $this->assertDatabaseHas('dialogs', [
      'id' => $channel->id,
      'author_id' => $newOwner->id,
    ]);
    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $channel->id,
      'user_id' => $newOwner->id,
      'role' => DialogMemberRole::OWNER->value,
    ]);
  }

  public function test_authenticated_admin_can_manage_group_members(): void {
    $admin = User::factory()->create();
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $group = Dialog::factory()->create([
      'author_id' => $owner->id,
      'title' => 'Support room',
      'type' => DialogType::GROUP,
    ]);

    $group->users()->attach($owner->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);

    $this->actingAs($admin);

    $this->get('/groups')->assertOk();

    $this
      ->post("/dialogs/{$group->id}/members", [
        'user_id' => $member->id,
        'role' => DialogMemberRole::ADMIN->value,
      ])
      ->assertRedirect();

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $group->id,
      'user_id' => $member->id,
      'role' => DialogMemberRole::ADMIN->value,
    ]);

    $this
      ->put("/dialogs/{$group->id}/members/{$member->id}", [
        'role' => DialogMemberRole::MEMBER->value,
        'muted' => true,
        'pinned' => false,
      ])
      ->assertRedirect();

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $group->id,
      'user_id' => $member->id,
      'role' => DialogMemberRole::MEMBER->value,
      'muted' => true,
      'pinned' => false,
    ]);

    $this
      ->delete("/dialogs/{$group->id}/members/{$member->id}")
      ->assertRedirect();

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $group->id,
      'user_id' => $member->id,
    ]);
  }
}
