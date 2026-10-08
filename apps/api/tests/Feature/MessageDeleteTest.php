<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageDeleteTest extends TestCase {
  use RefreshDatabase;

  public function test_sender_can_soft_delete_own_message(): void {
    $sender = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $sender->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);

    $this
      ->withToken($sender->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/messages/{$message->id}")
      ->assertOk()
      ->assertJsonPath('ok', true);

    $this->assertSoftDeleted('messages', [
      'id' => $message->id,
    ]);
  }

  public function test_dialog_admin_can_soft_delete_any_message(): void {
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $dialog->users()->sync([
      $admin->id => ['role' => DialogMemberRole::ADMIN->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $member->id,
    ]);

    $this
      ->withToken($admin->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/messages/{$message->id}")
      ->assertOk()
      ->assertJsonPath('ok', true);

    $this->assertSoftDeleted('messages', [
      'id' => $message->id,
    ]);
  }

  public function test_dialog_member_cannot_delete_someone_else_message(): void {
    $sender = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $dialog->users()->sync([
      $sender->id => ['role' => DialogMemberRole::MEMBER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->deleteJson("/api/v1/messages/{$message->id}")
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'deleted_at' => null,
    ]);
  }

  public function test_soft_deleted_message_is_hidden_from_message_list(): void {
    $sender = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $sender->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $visible = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);
    $deleted = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);
    $deleted->delete();

    $this
      ->withToken($sender->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/messages?dialog_id={$dialog->dialog_id}")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonCount(1, 'data')
      ->assertJsonPath('data.0.id', $visible->id);
  }
}
