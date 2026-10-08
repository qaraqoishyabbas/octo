<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageEditTest extends TestCase {
  use RefreshDatabase;

  public function test_sender_can_edit_own_message_text(): void {
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
      'message' => 'Старый текст',
      'created_at' => now()->subMinute(),
      'updated_at' => now()->subMinute(),
    ]);

    $this
      ->withToken($sender->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}", [
        'message' => 'Новый текст',
      ])
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.id', $message->id)
      ->assertJsonPath('data.message', 'Новый текст')
      ->assertJsonPath('data.is_edited', true);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'message' => 'Новый текст',
    ]);
  }

  public function test_message_links_are_resynced_after_edit(): void {
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
      'message' => 'Старый текст https://old.example/page',
    ]);
    $message->links()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
      'url' => 'https://old.example/page',
      'sort_order' => 0,
    ]);

    $this
      ->withToken($sender->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}", [
        'message' => 'Новый текст https://new.example/post',
      ])
      ->assertOk()
      ->assertJsonPath('data.links.0.url', 'https://new.example/post')
      ->assertJsonPath('data.links.0.title', 'new.example/post');

    $this->assertDatabaseMissing('message_links', [
      'message_id' => $message->id,
      'url' => 'https://old.example/page',
    ]);
    $this->assertDatabaseHas('message_links', [
      'message_id' => $message->id,
      'url' => 'https://new.example/post',
    ]);
  }

  public function test_message_is_not_marked_as_edited_before_update(): void {
    $sender = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $sender->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($sender->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Новый текст',
      ])
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.is_edited', false);
  }

  public function test_member_cannot_edit_someone_else_message(): void {
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
      'message' => 'Оригинал',
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}", [
        'message' => 'Попытка правки',
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseHas('messages', [
      'id' => $message->id,
      'message' => 'Оригинал',
    ]);
  }

  public function test_system_message_cannot_be_edited(): void {
    $owner = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => null,
      'message' => 'Системное сообщение',
    ]);

    $this
      ->withToken($owner->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}", [
        'message' => 'Попытка правки',
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);
  }

  public function test_text_message_cannot_be_edited_to_empty_text(): void {
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
      'message' => 'Текст',
    ]);

    $this
      ->withToken($sender->createToken('Test device')->plainTextToken)
      ->patchJson("/api/v1/messages/{$message->id}", [
        'message' => '',
      ])
      ->assertUnprocessable()
      ->assertJsonPath('errors.0.name', 'message');
  }
}
