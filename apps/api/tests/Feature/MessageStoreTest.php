<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\TemporaryUpload;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MessageStoreTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_store_message_in_existing_dialog(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Привет!',
      ]);

    $response
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.dialog_id', $dialog->id)
      ->assertJsonPath('data.sender_id', $user->id)
      ->assertJsonPath('data.message', 'Привет!')
      ->assertJsonPath('data.is_sender', true);

    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'message' => 'Привет!',
    ]);
  }

  public function test_message_links_are_extracted_normalized_and_saved_with_title_from_url(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Смотри www.example.com/page',
      ]);

    $response
      ->assertCreated()
      ->assertJsonPath('data.links.0.url', 'https://www.example.com/page')
      ->assertJsonPath('data.links.0.title', 'www.example.com/page');

    $this->assertDatabaseHas('message_links', [
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'url' => 'https://www.example.com/page',
      'title' => 'www.example.com/page',
    ]);
  }

  public function test_message_links_do_not_merge_anchor_urls_with_following_html_text(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $html = '<p>Duis velit augue.<br><a href="https://www.kinopoisk.ru/?utm_referrer=organic.kinopoisk.ru" target="_blank" rel="noopener noreferrer nofollow">https://www.kinopoisk.ru/?utm_referrer=organic.kinopoisk.ru</a><br>Vestibulum blandit ex diam.<br><a href="https://www.twitch.tv/gandreich" target="_blank" rel="noopener noreferrer nofollow">https://www.twitch.tv/gandreich</a><br>Sed tempor ex tincidunt.<br><a href="https://www.artstation.com/?sort_by=community&amp;dimension=all" target="_blank" rel="noopener noreferrer nofollow">https://www.artstation.com/?sort_by=community&amp;dimension=all</a></p>';

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => $html,
      ]);

    $response
      ->assertCreated()
      ->assertJsonCount(3, 'data.links')
      ->assertJsonPath('data.links.0.url', 'https://www.kinopoisk.ru/?utm_referrer=organic.kinopoisk.ru')
      ->assertJsonPath('data.links.1.url', 'https://www.twitch.tv/gandreich')
      ->assertJsonPath('data.links.2.url', 'https://www.artstation.com/?sort_by=community&dimension=all');

    $this->assertDatabaseMissing('message_links', [
      'url' => 'https://www.twitch.tv/gandreichSed',
    ]);
    $this->assertDatabaseMissing('message_links', [
      'url' => 'https://www.kinopoisk.ru/?utm_referrer=organic.kinopoisk.ruVestibulum',
    ]);
  }

  public function test_message_links_ignore_urls_inside_code_blocks(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $html = '<p>Visible link https://visible.example/page</p><pre><code>const url = "https://code.example/hidden";</code></pre><p><code>www.inline-code.example/hidden</code></p><p><a href="https://real.example/link">real link</a></p>';

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => $html,
      ]);

    $response
      ->assertCreated()
      ->assertJsonCount(2, 'data.links')
      ->assertJsonPath('data.links.0.url', 'https://real.example/link')
      ->assertJsonPath('data.links.1.url', 'https://visible.example/page');

    $this->assertDatabaseMissing('message_links', [
      'url' => 'https://code.example/hidden',
    ]);
    $this->assertDatabaseMissing('message_links', [
      'url' => 'https://www.inline-code.example/hidden',
    ]);
  }

  public function test_first_direct_message_creates_dialog(): void {
    $user = User::factory()->create();
    $recipient = User::factory()->create();

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $recipient->dialog_id,
        'message' => 'Начинаем чат',
      ]);

    $response
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.sender_id', $user->id)
      ->assertJsonPath('data.message', 'Начинаем чат');

    $message = Message::query()->first();

    $this->assertNotNull($message);
    $this->assertDatabaseHas('dialogs', [
      'id' => $message->dialog_id,
      'type' => DialogType::DIRECT->value,
    ]);
    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $message->dialog_id,
      'user_id' => $user->id,
    ]);
    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $message->dialog_id,
      'user_id' => $recipient->id,
    ]);
  }

  public function test_user_can_store_message_to_self_dialog(): void {
    $user = User::factory()->create();

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $user->dialog_id,
        'message' => 'В избранное',
      ]);

    $response
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.sender_id', $user->id)
      ->assertJsonPath('data.message', 'В избранное');

    $message = Message::query()->first();

    $this->assertNotNull($message);
    $this->assertDatabaseHas('dialogs', [
      'id' => $message->dialog_id,
      'type' => DialogType::DIRECT->value,
    ]);
    $this->assertDatabaseHas('dialog_user', [
      'dialog_id' => $message->dialog_id,
      'user_id' => $user->id,
    ]);
    $this->assertSame(1, DB::table('dialog_user')->where('dialog_id', $message->dialog_id)->count());
  }

  public function test_user_cannot_store_message_in_unrelated_dialog(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $dialog->users()->sync([
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Не должен пройти',
      ])
      ->assertNotFound()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseMissing('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'message' => 'Не должен пройти',
    ]);
  }

  public function test_channel_member_cannot_store_message(): void {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);

    $dialog->users()->sync([
      $owner->id => ['role' => DialogMemberRole::OWNER->value],
      $member->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    $this
      ->withToken($member->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Не должен пройти',
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseMissing('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $member->id,
      'message' => 'Не должен пройти',
    ]);
  }

  public function test_channel_admin_can_store_message(): void {
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
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Сообщение в канал',
      ])
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.sender_id', $admin->id)
      ->assertJsonPath('data.message', 'Сообщение в канал');

    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $admin->id,
      'message' => 'Сообщение в канал',
    ]);
  }

  public function test_channel_admin_without_send_permission_cannot_store_message(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
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
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Не должен пройти',
      ])
      ->assertForbidden()
      ->assertJsonPath('ok', false);

    $this->assertDatabaseMissing('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $admin->id,
      'message' => 'Не должен пройти',
    ]);
  }

  public function test_group_admin_keeps_member_send_permission_with_custom_admin_permissions(): void {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
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
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => 'Сообщение в группу',
      ])
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.sender_id', $admin->id)
      ->assertJsonPath('data.message', 'Сообщение в группу');

    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $admin->id,
      'message' => 'Сообщение в группу',
    ]);
  }

  public function test_user_can_reply_to_message_in_same_dialog(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $parent = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'message' => 'Исходное сообщение',
    ]);
    $parent->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $other->id,
      'type' => 'file',
      'mime_type' => 'application/pdf',
      'original_name' => 'document.pdf',
      'path' => 'messages/document.pdf',
      'size' => 10,
      'sort_order' => 0,
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'reply_to_id' => $parent->id,
        'message' => 'Ответ',
      ]);

    $response
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('data.reply_to_id', $parent->id)
      ->assertJsonPath('data.reply_to.id', $parent->id)
      ->assertJsonPath('data.reply_to.message', 'Исходное сообщение')
      ->assertJsonCount(1, 'data.reply_to.attachments')
      ->assertJsonPath('data.reply_to.attachments.0.type', 'file');

    $this->assertDatabaseHas('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'reply_to_id' => $parent->id,
      'message' => 'Ответ',
    ]);
  }

  public function test_user_cannot_reply_to_message_from_another_dialog(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $anotherDialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $anotherDialog->users()->sync([
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $parent = Message::factory()->create([
      'dialog_id' => $anotherDialog->id,
      'sender_id' => $other->id,
      'message' => 'Чужое сообщение',
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'reply_to_id' => $parent->id,
        'message' => 'Ответ',
      ])
      ->assertUnprocessable()
      ->assertJsonPath('errors.0.name', 'reply_to_id');

    $this->assertDatabaseMissing('messages', [
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
      'reply_to_id' => $parent->id,
      'message' => 'Ответ',
    ]);
  }

  public function test_message_attachment_is_moved_to_dialog_sender_file_path(): void {
    Storage::fake('public');

    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);

    Storage::disk('public')->put('messages/tmp/photo.jpg', 'photo body');
    $upload = TemporaryUpload::query()->create([
      'user_id' => $user->id,
      'path' => 'messages/tmp/photo.jpg',
      'type' => 'media',
      'mime_type' => 'image/jpeg',
      'original_name' => 'photo.jpg',
      'size' => 10,
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->postJson('/api/v1/messages', [
        'dialog_id' => $dialog->dialog_id,
        'message' => '',
        'attachments' => [$upload->id],
      ])
      ->assertCreated()
      ->assertJsonPath('ok', true)
      ->assertJsonCount(1, 'data.attachments');

    $attachment = $response->json('data.attachments.0');
    $expectedPath = "messages/{$dialog->id}/{$user->id}/photo.jpg";

    $this->assertSame($expectedPath, $attachment['path']);
    $this->assertDatabaseHas('message_attachments', [
      'id' => $attachment['id'],
      'dialog_id' => $dialog->id,
      'uploader_id' => $user->id,
      'path' => $expectedPath,
    ]);
    $this->assertDatabaseMissing('temporary_uploads', [
      'id' => $upload->id,
    ]);
    Storage::disk('public')->assertMissing('messages/tmp/photo.jpg');
    Storage::disk('public')->assertExists($expectedPath);
  }

}
