<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DialogUsernameTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_open_existing_direct_dialog_by_username(): void {
    $user = User::factory()->create();
    $other = User::factory()->create([
      'username' => 'oranzhevyy',
      'first_name' => 'Orange',
      'last_name' => 'User',
      'bio' => 'Люблю апельсиновый интерфейс',
      'email' => 'orange@example.com',
      'birth_date' => '1994-03-12',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs/oranzhevyy')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.id', $dialog->id)
      ->assertJsonPath('dialog.dialog_id', $other->dialog_id)
      ->assertJsonPath('dialog.username', 'oranzhevyy')
      ->assertJsonPath('dialog.bio', 'Люблю апельсиновый интерфейс')
      ->assertJsonPath('dialog.email', 'orange@example.com')
      ->assertJsonPath('dialog.birth_date', '1994-03-12')
      ->assertJsonPath('dialog.title', 'Orange User');
  }

  public function test_user_profile_includes_common_groups_without_channels(): void {
    $user = User::factory()->create();
    $other = User::factory()->create([
      'username' => 'oranzhevyy',
    ]);
    $directDialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $commonGroup = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'title' => 'Common group',
    ]);
    $commonChannel = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
      'title' => 'Common channel',
    ]);
    $userOnlyGroup = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'title' => 'User only group',
    ]);

    $directDialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $commonGroup->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $commonChannel->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $userOnlyGroup->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs/oranzhevyy')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonMissingPath('dialog.common_dialogs');

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs/oranzhevyy/groups')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonCount(1, 'groups');

    $this->assertSame($commonGroup->dialog_id, $response->json('groups.0.dialog_id'));
    $this->assertNotContains($commonChannel->dialog_id, array_column($response->json('groups'), 'dialog_id'));
  }

  public function test_user_can_preview_direct_dialog_by_username(): void {
    $user = User::factory()->create();
    $other = User::factory()->create([
      'username' => 'oranzhevyy',
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs/oranzhevyy')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.id', $other->id)
      ->assertJsonPath('dialog.dialog_id', $other->dialog_id)
      ->assertJsonPath('dialog.username', 'oranzhevyy')
      ->assertJsonPath('dialog.type', DialogType::DIRECT->value);
  }

  public function test_user_can_open_self_profile_by_username_as_saved_messages(): void {
    $user = User::factory()->create([
      'username' => 'oranzhevyy',
      'bio' => 'Мои заметки',
      'email' => 'me@example.com',
      'birth_date' => '1994-03-12',
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs/oranzhevyy')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.dialog_id', $user->dialog_id)
      ->assertJsonPath('dialog.username', 'oranzhevyy')
      ->assertJsonPath('dialog.bio', 'Мои заметки')
      ->assertJsonPath('dialog.email', 'me@example.com')
      ->assertJsonPath('dialog.birth_date', '1994-03-12')
      ->assertJsonPath('dialog.title', 'Избранное')
      ->assertJsonPath('dialog.is_self', true)
      ->assertJsonPath('dialog.users_count', 1);
  }

  public function test_self_dialog_is_displayed_as_saved_messages_in_dialog_list(): void {
    $user = User::factory()->create([
      'username' => 'oranzhevyy',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialogs.0.id', $dialog->id)
      ->assertJsonPath('dialogs.0.dialog_id', $user->dialog_id)
      ->assertJsonPath('dialogs.0.username', 'oranzhevyy')
      ->assertJsonPath('dialogs.0.title', 'Избранное')
      ->assertJsonPath('dialogs.0.is_self', true);
  }

  public function test_unknown_username_returns_not_found(): void {
    $user = User::factory()->create();

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs/missing-user')
      ->assertNotFound()
      ->assertJsonPath('ok', false);
  }
}
