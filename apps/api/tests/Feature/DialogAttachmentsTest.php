<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DialogAttachmentsTest extends TestCase {
  use RefreshDatabase;

  public function test_dialog_attachments_include_uploader_for_media_viewer(): void {
    $user = User::factory()->create();
    $sender = User::factory()->create([
      'first_name' => 'Sender',
      'last_name' => 'Person',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $sender->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);
    $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $sender->id,
      'type' => 'media',
      'mime_type' => 'image/jpeg',
      'original_name' => 'photo.jpg',
      'path' => 'messages/photo.jpg',
      'size' => 100,
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/attachments?type=media")
      ->assertOk()
      ->assertJsonPath('attachments.0.uploader.id', $sender->id)
      ->assertJsonPath('attachments.0.uploader.name', 'Sender Person');
  }

  public function test_dialog_attachments_split_by_upload_type_not_mime_type(): void {
    $user = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
    ]);

    $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $user->id,
      'type' => 'file',
      'mime_type' => 'image/jpeg',
      'original_name' => 'photo-as-file.jpg',
      'path' => 'messages/photo-as-file.jpg',
      'size' => 100,
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/attachments?type=files")
      ->assertOk()
      ->assertJsonCount(1, 'attachments')
      ->assertJsonPath('attachments.0.type', 'file')
      ->assertJsonPath('attachments.0.mime_type', 'image/jpeg');

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/attachments?type=media")
      ->assertOk()
      ->assertJsonCount(0, 'attachments');
  }

  public function test_dialog_attachments_hide_files_from_soft_deleted_messages(): void {
    $user = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $user->id,
    ]);

    $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $user->id,
      'type' => 'media',
      'mime_type' => 'image/jpeg',
      'original_name' => 'deleted-photo.jpg',
      'path' => 'messages/deleted-photo.jpg',
      'size' => 100,
      'sort_order' => 0,
    ]);
    $message->delete();

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/attachments?type=media")
      ->assertOk()
      ->assertJsonCount(0, 'attachments');
  }

  public function test_dialog_links_are_listed_for_profile(): void {
    $user = User::factory()->create();
    $sender = User::factory()->create([
      'first_name' => 'Sender',
      'last_name' => 'Person',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $sender->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);
    $message->links()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
      'url' => 'https://example.com',
      'title' => 'Example',
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/links")
      ->assertOk()
      ->assertJsonCount(1, 'links')
      ->assertJsonPath('links.0.title', 'Example')
      ->assertJsonPath('links.0.sender.id', $sender->id)
      ->assertJsonPath('links.0.sender.name', 'Sender Person');
  }

  public function test_non_member_can_view_channel_attachments_and_links(): void {
    $user = User::factory()->create();
    $sender = User::factory()->create([
      'first_name' => 'Channel',
      'last_name' => 'Owner',
    ]);
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $dialog->users()->attach($sender->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
    ]);
    $message->attachments()->create([
      'dialog_id' => $dialog->id,
      'uploader_id' => $sender->id,
      'type' => 'media',
      'mime_type' => 'image/jpeg',
      'original_name' => 'channel-photo.jpg',
      'path' => 'messages/channel-photo.jpg',
      'size' => 100,
      'sort_order' => 0,
    ]);
    $message->links()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
      'url' => 'https://example.com/channel',
      'title' => 'Channel Link',
      'sort_order' => 0,
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/attachments?type=media")
      ->assertOk()
      ->assertJsonCount(1, 'attachments')
      ->assertJsonPath('attachments.0.original_name', 'channel-photo.jpg')
      ->assertJsonPath('attachments.0.uploader.name', 'Channel Owner');

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/dialogs/{$dialog->dialog_id}/links")
      ->assertOk()
      ->assertJsonCount(1, 'links')
      ->assertJsonPath('links.0.title', 'Channel Link')
      ->assertJsonPath('links.0.sender.name', 'Channel Owner');
  }
}
