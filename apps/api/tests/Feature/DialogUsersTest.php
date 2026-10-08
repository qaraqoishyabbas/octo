<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Events\DialogRealtimeEvent;
use App\Helpers\MessageText;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\TemporaryUpload;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class DialogUsersTest extends TestCase {
  use RefreshDatabase;

  private function assertMemberLastReadAtIsNotNull(Dialog $dialog, User $user): void {
    $this->assertNotNull(
      DB::table('dialog_user')
        ->where('dialog_id', $dialog->id)
        ->where('user_id', $user->id)
        ->value('last_read_at')
    );
  }

  private function systemMessage(string $message): string {
    return MessageText::paragraph($message);
  }

  public function test_group_members_can_be_loaded(): void {
    $owner = User::factory()->create([
      'first_name' => 'Owner',
      'last_name' => 'User',
    ]);
    $recentMember = User::factory()->create([
      'first_name' => 'Recent',
      'last_name' => 'User',
    ]);
    $admin = User::factory()->create([
      'first_name' => 'Admin',
      'last_name' => 'User',
    ]);
    $oldMember = User::factory()->create([
      'first_name' => 'Old',
      'last_name' => 'User',
    ]);
    $alphaMember = User::factory()->create([
      'first_name' => 'Alpha',
      'last_name' => 'User',
    ]);
    $betaMember = User::factory()->create([
      'first_name' => 'Beta',
      'last_name' => 'User',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $recentMember->createToken('Recent device')->accessToken->forceFill([
      'last_used_at' => Carbon::parse('2026-06-11 10:00:00'),
    ])->save();
    $admin->createToken('Admin device')->accessToken->forceFill([
      'last_used_at' => Carbon::parse('2026-06-01 10:00:00'),
    ])->save();
    $oldMember->createToken('Old device')->accessToken->forceFill([
      'last_used_at' => Carbon::parse('2026-05-01 10:00:00'),
    ])->save();

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $recentMember->id => ['role' => DialogMemberRole::MEMBER->value],
      $oldMember->id => ['role' => DialogMemberRole::MEMBER->value],
      $betaMember->id => ['role' => DialogMemberRole::MEMBER->value],
      $alphaMember->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $response = $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('total', 6)
      ->assertJsonPath('users.0.dialog_role', DialogMemberRole::OWNER->value);

    $this->assertSame([
      $owner->id,
      $recentMember->id,
      $admin->id,
      $oldMember->id,
      $alphaMember->id,
      $betaMember->id,
    ], array_column($response->json('users'), 'id'));
  }

  public function test_group_creation_adds_message_about_added_members(): void {
    Event::fake([DialogRealtimeEvent::class]);

    $owner = User::factory()->create();
    $member = User::factory()->create();

    $response = $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/group', [
        'title' => 'Project group',
        'users' => [$member->id],
      ])
      ->assertOk()
      ->assertJsonPath('ok', true);

    $dialog = Dialog::query()->wherePublicDialogId($response->json('data'))->firstOrFail();
    $createdMessage = Message::query()
      ->where('dialog_id', $dialog->id)
      ->where('message', 'Группа создана')
      ->firstOrFail();
    $addedMessage = Message::query()
      ->where('dialog_id', $dialog->id)
      ->where('message', $this->systemMessage(
        MessageText::mention($owner) . ' добавил участников: ' . MessageText::mention($member),
      ))
      ->firstOrFail();

    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => null,
      'message' => 'Группа создана',
    ]);
    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => null,
      'message' => $this->systemMessage(
        MessageText::mention($owner) . ' добавил участников: ' . MessageText::mention($member),
      ),
    ]);

    $ownerLastReadAt = DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $owner->id)
      ->value('last_read_at');
    $memberLastReadAt = DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $member->id)
      ->value('last_read_at');

    $this->assertSame(
      $addedMessage->created_at->toDateTimeString(),
      Carbon::parse($ownerLastReadAt)->toDateTimeString()
    );
    $this->assertNull($memberLastReadAt);

    $this
      ->withToken($owner->createToken('Owner device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.dialog_id', $dialog->dialog_id)
      ->assertJsonPath('dialogs.0.counter', 0);

    auth()->forgetGuards();

    $this
      ->withToken($member->createToken('Member device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.dialog_id', $dialog->dialog_id)
      ->assertJsonPath('dialogs.0.counter', 2);

    Event::assertDispatched(
      DialogRealtimeEvent::class,
      fn(DialogRealtimeEvent $event) => $event->broadcastAs() === 'dialog.membership.changed'
        && $event->broadcastWith()['dialog_public_id'] === $dialog->dialog_id
        && $event->broadcastWith()['action'] === 'added'
        && $event->broadcastWith()['user_id'] === (string)$member->id,
    );
  }

  public function test_channel_creation_starts_read_for_owner(): void {
    $owner = User::factory()->create();

    $response = $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/channel', [
        'title' => 'Project channel',
        'description' => 'Announcements',
      ])
      ->assertOk()
      ->assertJsonPath('ok', true);

    $dialog = Dialog::query()->wherePublicDialogId($response->json('data'))->firstOrFail();
    $createdMessage = Message::query()
      ->where('dialog_id', $dialog->id)
      ->where('message', 'Канал создан')
      ->firstOrFail();
    $ownerLastReadAt = DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $owner->id)
      ->value('last_read_at');

    $this->assertSame($createdMessage->created_at->toDateTimeString(), Carbon::parse($ownerLastReadAt)->toDateTimeString());

    $this
      ->withToken($owner->createToken('Owner device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.dialog_id', $dialog->dialog_id)
      ->assertJsonPath('dialogs.0.counter', 0);
  }

  public function test_direct_dialog_members_are_not_exposed_as_audience(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users")
      ->assertNotFound()
      ->assertJsonPath('ok', false);
  }

  public function test_group_members_can_be_filtered_by_role(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users?role=admin")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('total', 1)
      ->assertJsonPath('users.0.id', $admin->id)
      ->assertJsonPath('users.0.dialog_role', DialogMemberRole::ADMIN->value);
  }

  public function test_group_members_can_be_filtered_by_roles(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $response = $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users?roles[]=owner&roles[]=admin")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('total', 2);

    $this->assertSame([
      $owner->id,
      $admin->id,
    ], array_column($response->json('users'), 'id'));
  }

  public function test_group_members_can_be_filtered_by_comma_separated_roles(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $response = $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users?roles=owner,admin")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('total', 2);

    $this->assertSame([
      $owner->id,
      $admin->id,
    ], array_column($response->json('users'), 'id'));
  }

  public function test_group_owner_can_add_members(): void {
    $owner = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/users", [
        'users' => [$newMember->id],
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('added', 1)
      ->assertJsonPath('users_count', 2)
      ->assertJsonPath('message.sender_id', null);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
      'role' => DialogMemberRole::MEMBER->value,
    ]);
    $this->assertMemberLastReadAtIsNotNull($dialog, $newMember);
    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => null,
      'message' => $this->systemMessage(
        MessageText::mention($owner) . ' добавил участников: ' . MessageText::mention($newMember),
      ),
    ]);
  }

  public function test_group_admin_can_add_members(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/users", [
        'users' => [$newMember->id],
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('added', 1);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
      'role' => DialogMemberRole::MEMBER->value,
    ]);
  }

  public function test_group_member_cannot_add_members(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/users", [
        'users' => [$newMember->id],
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
    ]);
  }

  public function test_group_owner_can_make_member_admin(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $response = $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$member->id}/role", [
        'role' => DialogMemberRole::ADMIN->value,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('user_id', $member->id)
      ->assertJsonPath('role', DialogMemberRole::ADMIN->value);

    $this->assertNotContains(DialogPermission::MANAGE_ADMINS->value, $response->json('permissions'));
    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $member->id,
      'role' => DialogMemberRole::ADMIN->value,
    ]);
    $this->assertDatabaseMissing('messages', [
      'dialog_id' => $dialog->id,
      'message' => "{$owner->name} сделал администратором {$member->name}",
    ]);
  }

  public function test_group_admin_cannot_make_member_admin(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$member->id}/role", [
        'role' => DialogMemberRole::ADMIN->value,
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $member->id,
      'role' => DialogMemberRole::MEMBER->value,
    ]);
  }

  public function test_group_owner_can_remove_admin_role(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$admin->id}/role", [
        'role' => DialogMemberRole::MEMBER->value,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('user_id', $admin->id)
      ->assertJsonPath('role', DialogMemberRole::MEMBER->value);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $admin->id,
      'role' => DialogMemberRole::MEMBER->value,
    ]);
  }

  public function test_group_admin_cannot_remove_admin_role(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $otherAdmin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $otherAdmin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$otherAdmin->id}/role", [
        'role' => DialogMemberRole::MEMBER->value,
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $otherAdmin->id,
      'role' => DialogMemberRole::ADMIN->value,
    ]);
  }

  public function test_group_owner_role_cannot_be_changed(): void {
    $owner = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$owner->id}/role", [
        'role' => DialogMemberRole::ADMIN->value,
      ])
      ->assertUnprocessable()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $owner->id,
      'role' => DialogMemberRole::OWNER->value,
    ]);
  }

  public function test_group_owner_can_remove_admin_from_group(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$admin->id}")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('removed', true)
      ->assertJsonPath('user_id', $admin->id)
      ->assertJsonPath('users_count', 1)
      ->assertJsonPath('message.sender_id', null)
      ->assertJsonPath(
        'message.message',
        $this->systemMessage(MessageText::mention($owner) . ' исключил участника: ' . MessageText::mention($admin)),
      );

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $admin->id,
    ]);
  }

  public function test_group_admin_can_remove_member_from_group(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$member->id}")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('users_count', 2)
      ->assertJsonPath(
        'message.message',
        $this->systemMessage(MessageText::mention($admin) . ' исключил участника: ' . MessageText::mention($member)),
      );

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $member->id,
    ]);
  }

  public function test_group_admin_cannot_remove_admin_from_group(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $otherAdmin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $otherAdmin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$otherAdmin->id}")
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $otherAdmin->id,
      'role' => DialogMemberRole::ADMIN->value,
    ]);
  }

  public function test_group_owner_cannot_be_removed_from_group(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/users/{$owner->id}")
      ->assertUnprocessable()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $owner->id,
      'role' => DialogMemberRole::OWNER->value,
    ]);
  }

  public function test_group_member_can_leave_group(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/leave")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('left', true)
      ->assertJsonPath('dialog_id', $dialog->dialog_id)
      ->assertJsonPath('users_count', 1)
      ->assertJsonPath('message.sender_id', null)
      ->assertJsonPath(
        'message.message',
        $this->systemMessage(MessageText::mention($member) . ' вышел из группы'),
      );

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $member->id,
    ]);
  }

  public function test_channel_admin_can_leave_channel_without_message(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/leave")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('left', true)
      ->assertJsonPath('dialog_id', $dialog->dialog_id)
      ->assertJsonPath('users_count', 1)
      ->assertJsonPath('message', null);

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $admin->id,
    ]);
  }

  public function test_group_owner_cannot_leave_group(): void {
    $owner = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/dialogs/{$dialog->dialog_id}/leave")
      ->assertUnprocessable()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $owner->id,
      'role' => DialogMemberRole::OWNER->value,
    ]);
  }

  public function test_group_owner_can_update_group_details(): void {
    $owner = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'title' => 'Old title',
      'description' => null,
      'avatar' => null,
    ]);
    $avatar = 'avatars/11111111-1111-1111-1111-111111111111.png';

    TemporaryUpload::query()->create(['path' => $avatar]);
    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}", [
        'title' => 'New group title',
        'description' => 'New group description',
        'avatar' => $avatar,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.title', 'New group title')
      ->assertJsonPath('dialog.description', 'New group description')
      ->assertJsonPath('dialog.avatar', $avatar);

    $this->assertDatabaseHas('dialogs', [
      'id' => $dialog->id,
      'title' => 'New group title',
      'description' => 'New group description',
      'avatar' => $avatar,
    ]);
    $this->assertDatabaseMissing('temporary_uploads', [
      'path' => $avatar,
    ]);
  }

  public function test_channel_admin_can_update_channel_details(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
      'title' => 'Old channel',
      'description' => 'Old description',
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}", [
        'title' => 'New channel',
        'description' => 'New channel description',
        'avatar' => null,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.title', 'New channel')
      ->assertJsonPath('dialog.description', 'New channel description');

    $this->assertDatabaseHas('dialogs', [
      'id' => $dialog->id,
      'title' => 'New channel',
      'description' => 'New channel description',
    ]);
  }

  public function test_group_member_cannot_update_group_details(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'title' => 'Old title',
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}", [
        'title' => 'New title',
        'description' => null,
        'avatar' => null,
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('dialogs', [
      'id' => $dialog->id,
      'title' => 'Old title',
    ]);
  }

  public function test_direct_dialog_cannot_be_updated_as_group_or_channel(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
      'title' => null,
    ]);

    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}", [
        'title' => 'New title',
        'description' => null,
        'avatar' => null,
      ])
      ->assertNotFound()
      ->assertJsonPath('ok', false);
  }

  public function test_group_admin_can_create_invite_link(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
    ]);

    $response = $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/invite-link")
      ->assertOk()
      ->assertJsonPath('ok', true);

    $this->assertIsString($response->json('token'));
    $this->assertSame(16, strlen($response->json('token')));
    $this->assertDatabaseHas('dialogs', [
      'id' => $dialog->id,
      'invite_token' => $response->json('token'),
    ]);
  }

  public function test_group_member_cannot_create_invite_link(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/invite-link")
      ->assertForbidden()
      ->assertJsonPath('ok', false);
  }

  public function test_group_admin_without_invite_permission_cannot_add_members(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => [
        'role' => DialogMemberRole::ADMIN->value,
        'permissions' => json_encode([DialogPermission::MANAGE_DIALOG->value]),
      ],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/users", [
        'users' => [$newMember->id],
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
    ]);
  }

  public function test_group_admin_with_manage_dialog_permission_can_update_details(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'title' => 'Old group',
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => [
        'role' => DialogMemberRole::ADMIN->value,
        'permissions' => json_encode([DialogPermission::MANAGE_DIALOG->value]),
      ],
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}", [
        'title' => 'Managed group',
        'description' => 'Updated by limited admin',
        'avatar' => null,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.title', 'Managed group');

    $this->assertDatabaseHas('dialogs', [
      'id' => $dialog->id,
      'title' => 'Managed group',
    ]);
  }

  public function test_user_can_view_group_invite_info(): void {
    $owner = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'title' => 'Invite group',
      'description' => 'Invite description',
      'invite_token' => 'group-invite-token',
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($newMember->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/invites/group-invite-token')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog.dialog_id', $dialog->dialog_id)
      ->assertJsonPath('dialog.title', 'Invite group')
      ->assertJsonPath('dialog.description', 'Invite description')
      ->assertJsonPath('dialog.type', DialogType::GROUP->value)
      ->assertJsonPath('dialog.users_count', 1)
      ->assertJsonPath('dialog.is_member', false);
  }

  public function test_user_can_join_group_by_invite_link(): void {
    $owner = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
      'invite_token' => 'group-invite-token',
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($newMember->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/invites/group-invite-token/join')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog_id', $dialog->dialog_id)
      ->assertJsonPath('joined', true);

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
      'role' => DialogMemberRole::MEMBER->value,
    ]);
    $this->assertMemberLastReadAtIsNotNull($dialog, $newMember);
    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => null,
      'message' => $this->systemMessage(MessageText::mention($newMember) . ' присоединился по ссылке приглашения'),
    ]);
  }

  public function test_user_joining_channel_by_invite_link_starts_from_latest_message(): void {
    $owner = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
      'invite_token' => 'channel-invite-token',
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);
    $latestMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $owner->id,
      'created_at' => Carbon::parse('2026-06-15 10:00:00'),
    ]);

    $this
      ->withToken($newMember->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/invites/channel-invite-token/join')
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog_id', $dialog->dialog_id)
      ->assertJsonPath('joined', true);

    $lastReadAt = DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $newMember->id)
      ->value('last_read_at');

    $this->assertSame($latestMessage->created_at->toDateTimeString(), Carbon::parse($lastReadAt)->toDateTimeString());
  }

  public function test_user_can_subscribe_to_public_channel(): void {
    $owner = User::factory()->create();
    $subscriber = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);
    $latestMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $owner->id,
      'created_at' => Carbon::parse('2026-06-15 10:00:00'),
    ]);

    $this
      ->withToken($subscriber->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/join")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('dialog_id', $dialog->dialog_id)
      ->assertJsonPath('joined', true)
      ->assertJsonPath('users_count', 2);

    $membership = DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $subscriber->id)
      ->first();

    $this->assertNotNull($membership);
    $this->assertSame(DialogMemberRole::MEMBER->value, $membership->role);
    $this->assertSame(
      $latestMessage->created_at->toDateTimeString(),
      Carbon::parse($membership->last_read_at)->toDateTimeString(),
    );
  }

  public function test_subscribing_to_public_channel_is_idempotent(): void {
    $owner = User::factory()->create();
    $subscriber = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $subscriber->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($subscriber->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/join")
      ->assertOk()
      ->assertJsonPath('joined', false)
      ->assertJsonPath('users_count', 2);

    $this->assertSame(1, DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $subscriber->id)
      ->count());
  }

  public function test_user_cannot_subscribe_to_group_without_invite(): void {
    $owner = User::factory()->create();
    $user = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson("/api/v1/dialogs/{$dialog->dialog_id}/join")
      ->assertNotFound();

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $user->id,
    ]);
  }

  public function test_user_can_mute_public_channel_before_subscribing(): void {
    $owner = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);
    $latestMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $owner->id,
      'created_at' => Carbon::parse('2026-06-15 10:00:00'),
    ]);

    $this
      ->withToken($newMember->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/mute")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('muted', true);

    $lastReadAt = DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $newMember->id)
      ->value('last_read_at');

    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
      'role' => DialogMemberRole::MEMBER->value,
      'muted' => true,
    ]);
    $this->assertSame($latestMessage->created_at->toDateTimeString(), Carbon::parse($lastReadAt)->toDateTimeString());
  }

  public function test_user_cannot_mute_group_before_joining(): void {
    $owner = User::factory()->create();
    $newMember = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($newMember->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/mute")
      ->assertNotFound()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseMissing('dialog_user', [
      'dialog_id' => $dialog->id,
      'user_id' => $newMember->id,
    ]);
  }

  public function test_non_member_can_view_channel_users(): void {
    $user = User::factory()->create();
    $owner = User::factory()->create([
      'first_name' => 'Channel',
      'last_name' => 'Owner',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $dialog->users()->attach($owner->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users")
      ->assertOk()
      ->assertJsonCount(1, 'users')
      ->assertJsonPath('users.0.id', $owner->id)
      ->assertJsonPath('users.0.name', 'Channel Owner')
      ->assertJsonPath('users.0.dialog_role', DialogMemberRole::OWNER->value);
  }

  public function test_unrelated_dialog_members_are_not_exposed(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $dialog->users()->sync([
      $other->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/users")
      ->assertNotFound()
      ->assertJsonPath('ok', false);
  }
}
