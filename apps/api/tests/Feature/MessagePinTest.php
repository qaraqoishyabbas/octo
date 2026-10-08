<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MessagePinTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_pin_and_unpin_message_in_dialog(): void {
    Carbon::setTestNow('2026-06-20 12:00:00');

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Можно закрепить',
      'created_at' => Carbon::parse('2026-06-20 11:00:00'),
      'updated_at' => Carbon::parse('2026-06-20 11:00:00'),
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}/pin");

    $response
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('pinned', true)
      ->assertJsonPath('data.id', $message->id)
      ->assertJsonPath('data.is_pinned', true)
      ->assertJsonPath('data.is_edited', false);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'pinned_by_id' => $user->id,
      'updated_at' => '2026-06-20 11:00:00',
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}/pin")
      ->assertOk()
      ->assertJsonPath('pinned', false)
      ->assertJsonPath('data.is_pinned', false);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'pinned_at' => null,
      'pinned_by_id' => null,
      'updated_at' => '2026-06-20 11:00:00',
    ]);

    Carbon::setTestNow();
  }

  public function test_user_can_list_pinned_messages_in_dialog(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $older = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Старое закрепленное',
      'pinned_at' => Carbon::parse('2026-06-20 10:00:00'),
      'pinned_by_id' => $user->id,
    ]);
    $newer = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Новое закрепленное',
      'pinned_at' => Carbon::parse('2026-06-20 12:00:00'),
      'pinned_by_id' => $user->id,
    ]);
    Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Обычное сообщение',
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/messages/pinned?dialog_id={$dialog->dialog_id}");

    $response
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('total', 2);

    $this->assertSame([
      $newer->id,
      $older->id,
    ], array_column($response->json('data'), 'id'));
  }

  public function test_channel_member_cannot_pin_message(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $owner->id,
      'message' => 'Сообщение канала',
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}/pin")
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'pinned_at' => null,
      'pinned_by_id' => null,
    ]);
  }

  public function test_channel_admin_with_pin_permission_can_pin_message(): void {
    Carbon::setTestNow('2026-06-20 12:00:00');

    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $admin->id => [
        'role' => DialogMemberRole::ADMIN->value,
        'permissions' => json_encode([DialogPermission::PIN_MESSAGES->value]),
      ],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $owner->id,
      'message' => 'Сообщение канала',
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}/pin")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('pinned', true);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'pinned_by_id' => $admin->id,
    ]);

    Carbon::setTestNow();
  }
}
