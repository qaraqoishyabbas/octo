<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DialogUnreadMessagesTest extends TestCase {
  use RefreshDatabase;

  protected function tearDown(): void {
    Carbon::setTestNow();

    parent::tearDown();
  }

  public function test_dialog_index_contains_unread_messages_counter(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);

    $dialog->users()->sync([
      $user->id => [
        'role' => DialogMemberRole::MEMBER->value,
        'last_read_at' => Carbon::parse('2026-06-11 10:30:00'),
      ],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 10:00:00'),
    ]);
    $firstUnreadMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);
    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'created_at' => Carbon::parse('2026-06-11 11:30:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.dialog_id', $other->dialog_id)
      ->assertJsonPath('dialogs.0.counter', 1)
      ->assertJsonPath('dialogs.0.first_unread_message_id', $firstUnreadMessage->id);
  }

  public function test_dialog_index_marks_unread_mentions_as_reminders(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create([
      'username' => 'orange',
    ]);
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $user->id => [
        'role' => DialogMemberRole::MEMBER->value,
        'last_read_at' => Carbon::parse('2026-06-11 10:30:00'),
      ],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Привет [@ id="' . $user->id . '" label="Orange"]',
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.has_reminder', true);
  }

  public function test_dialog_index_marks_unread_editor_mentions_as_reminders(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create([
      'username' => 'orange',
    ]);
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $user->id => [
        'role' => DialogMemberRole::MEMBER->value,
        'last_read_at' => Carbon::parse('2026-06-11 10:30:00'),
      ],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => '<p>Привет <span class="message-mention" data-type="mention" data-id="' . $user->id . '" data-label="Orange">Orange</span></p>',
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.has_reminder', true);
  }

  public function test_dialog_index_keeps_uuid_mentions_after_username_changes(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create([
      'username' => 'orange',
    ]);
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $user->id => [
        'role' => DialogMemberRole::MEMBER->value,
        'last_read_at' => Carbon::parse('2026-06-11 10:30:00'),
      ],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => '<p>Привет <span class="message-mention" data-type="mention" data-id="' . $user->id . '" data-label="Orange">Orange</span></p>',
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);

    $user->update(['username' => 'new-orange']);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.has_reminder', true);
  }

  public function test_dialog_index_does_not_mark_read_or_own_mentions_as_reminders(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create([
      'username' => 'orange',
    ]);
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);

    $dialog->users()->sync([
      $user->id => [
        'role' => DialogMemberRole::MEMBER->value,
        'last_read_at' => Carbon::parse('2026-06-11 11:30:00'),
      ],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Прочитанное [@ id="' . $user->id . '" label="Orange"]',
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);
    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'message' => 'Свое [@ id="' . $user->id . '" label="Orange"]',
      'created_at' => Carbon::parse('2026-06-11 12:00:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.has_reminder', false);
  }

  public function test_dialog_can_be_marked_as_read(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);

    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/read")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('counter', 0);

    $this->assertNotNull(
      DB::table('dialog_user')
        ->where('dialog_id', $dialog->id)
        ->where('user_id', $user->id)
        ->value('last_read_at')
    );

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.counter', 0);
  }

  public function test_mark_as_read_uses_latest_message_time_instead_of_current_time(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);

    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 12:30:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/read")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('counter', 0);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.counter', 0);
  }

  public function test_dialog_can_be_marked_as_read_until_message(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);

    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 10:00:00'),
    ]);
    $secondMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);
    $thirdMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 11:30:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/read", [
        'message_id' => $secondMessage->id,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('counter', 1)
      ->assertJsonPath('first_unread_message_id', $thirdMessage->id)
      ->assertJsonPath('last_read_at', $secondMessage->created_at->toJSON());
  }

  public function test_mark_as_read_until_message_does_not_move_read_position_backwards(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);

    $dialog->users()->sync([
      $user->id => [
        'role' => DialogMemberRole::MEMBER->value,
        'last_read_at' => Carbon::parse('2026-06-11 11:00:00'),
      ],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $oldMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 10:00:00'),
    ]);
    $unreadMessage = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 11:30:00'),
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/read", [
        'message_id' => $oldMessage->id,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('counter', 1)
      ->assertJsonPath('first_unread_message_id', $unreadMessage->id)
      ->assertJsonPath('last_read_at', Carbon::parse('2026-06-11 11:00:00')->toJSON());
  }
}
