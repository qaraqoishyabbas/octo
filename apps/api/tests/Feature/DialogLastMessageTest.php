<?php

namespace Tests\Feature;

use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DialogLastMessageTest extends TestCase {
  use RefreshDatabase;

  public function test_last_message_query_does_not_aggregate_uuid_columns_on_postgres(): void {
    $dialog = new Dialog;
    $dialog->setConnection('pgsql');
    $dialog->id = '00000000-0000-4000-8000-000000000001';

    $sql = $dialog->message()->toSql();

    $this->assertDoesNotMatchRegularExpression('/\b(?:max|min)\([^)]*"messages"\."id"/i', $sql);
  }

  public function test_dialog_index_selects_one_latest_visible_message_per_dialog(): void {
    $user = User::factory()->create();
    $first = Dialog::factory()->create();
    $second = Dialog::factory()->create();
    $empty = Dialog::factory()->create();
    foreach ([$first, $second, $empty] as $dialog) {
      $dialog->users()->attach($user);
    }

    Message::factory()->create([
      'dialog_id' => $first->id,
      'sender_id' => $user->id,
      'created_at' => '2026-10-01 12:00:00',
    ]);
    Message::factory()->create([
      'id' => '00000000-0000-4000-8000-000000000010',
      'dialog_id' => $first->id,
      'sender_id' => $user->id,
      'created_at' => '2026-10-02 12:00:00',
    ]);
    $latest = Message::factory()->create([
      'id' => '00000000-0000-4000-8000-000000000020',
      'dialog_id' => $first->id,
      'sender_id' => $user->id,
      'created_at' => '2026-10-02 12:00:00',
    ]);
    $deleted = Message::factory()->create([
      'dialog_id' => $first->id,
      'sender_id' => $user->id,
      'created_at' => '2026-10-03 12:00:00',
    ]);
    $deleted->delete();
    $otherLatest = Message::factory()->create([
      'dialog_id' => $second->id,
      'sender_id' => $user->id,
      'created_at' => '2026-10-04 12:00:00',
    ]);

    $response = $this->withToken($user->createToken('Test')->plainTextToken)
      ->getJson('/api/v1/dialogs')->assertOk();
    $dialogs = collect($response->json('dialogs'))->keyBy('id');
    $this->assertSame($latest->id, $dialogs[$first->id]['message']['id']);
    $this->assertSame($otherLatest->id, $dialogs[$second->id]['message']['id']);
    $this->assertNull($dialogs[$empty->id]['message']);
    $this->assertSame($latest->id, $first->fresh()->message->id);

    // Eager loading must fetch just the selected messages, not the entire history.
    $retrieved = [];
    Message::retrieved(function (Message $message) use (&$retrieved) {
      $retrieved[] = $message->id;
    });
    $loaded = Dialog::whereKey([$first->id, $second->id])->withLastMessage()->get();
    $this->assertCount(2, $retrieved);
    $this->assertEqualsCanonicalizing([$latest->id, $otherLatest->id], $retrieved);
  }
}
