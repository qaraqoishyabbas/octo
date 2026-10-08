<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MessageCursorTest extends TestCase {
  use RefreshDatabase;

  public function test_messages_around_uuid_cursor_are_ordered_by_created_at(): void {
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
      'id' => 'ffffffff-ffff-7fff-bfff-ffffffffffff',
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 10:00:00'),
    ]);
    $target = Message::factory()->create([
      'id' => '88888888-8888-7888-b888-888888888888',
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 11:00:00'),
    ]);
    $newer = Message::factory()->create([
      'id' => '00000000-0000-7000-b000-000000000000',
      'dialog_id' => $dialog->id,
      'sender_id' => $other->id,
      'created_at' => Carbon::parse('2026-06-11 12:00:00'),
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/messages?dialog_id={$dialog->dialog_id}&cursor_id={$target->id}")
      ->assertOk()
      ->assertJsonPath('ok', true);

    $this->assertSame([
      $older->id,
      $target->id,
      $newer->id,
    ], array_column($response->json('data'), 'id'));
  }

  public function test_non_member_can_read_channel_messages(): void {
    $user = User::factory()->create();
    $sender = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $dialog->users()->attach($sender->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $dialog->id,
      'sender_id' => $sender->id,
      'message' => 'Public channel update',
    ]);

    $response = $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->getJson("/api/v1/messages?dialog_id={$dialog->dialog_id}")
      ->assertOk()
      ->assertJsonPath('ok', true);

    $this->assertSame([$message->id], array_column($response->json('data'), 'id'));
  }
}
