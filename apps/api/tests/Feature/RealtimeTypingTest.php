<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Events\DialogRealtimeEvent;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RealtimeTypingTest extends TestCase {
  use RefreshDatabase;

  public function test_direct_dialog_typing_broadcasts_realtime_event(): void {
    Event::fake([DialogRealtimeEvent::class]);

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
      ->patchJson('/api/v1/realtime/typing', [
        'dialog_id' => $other->dialog_id,
        'typing' => true,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true);

    Event::assertDispatched(
      DialogRealtimeEvent::class,
      fn(DialogRealtimeEvent $event) => $event->broadcastAs() === 'dialog.typing'
        && $event->broadcastWith()['dialog_id'] === (string)$dialog->id
        && $event->broadcastWith()['dialog_public_id'] === $dialog->dialog_id
        && $event->broadcastWith()['typing'] === true
        && $event->broadcastWith()['user']['id'] === (string)$user->id
        && collect($event->broadcastOn())->pluck('name')->all() === ["private-user.{$other->id}"],
    );
  }

  public function test_channel_typing_does_not_broadcast_realtime_event(): void {
    Event::fake([DialogRealtimeEvent::class]);

    $user = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);

    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::OWNER->value],
    ]);

    $this
      ->withToken($user->createToken('Test device')->plainTextToken)
      ->patchJson('/api/v1/realtime/typing', [
        'dialog_id' => $dialog->dialog_id,
        'typing' => true,
      ])
      ->assertOk()
      ->assertJsonPath('ok', true);

    Event::assertNotDispatched(DialogRealtimeEvent::class);
  }
}
