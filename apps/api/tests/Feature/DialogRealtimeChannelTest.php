<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Events\DialogRealtimeEvent;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use App\Support\DialogRealtime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class DialogRealtimeChannelTest extends TestCase {
  use RefreshDatabase;

  public function test_non_member_can_authenticate_public_channel_realtime_channel(): void {
    $guest = User::factory()->create();
    $channel = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $authorizer = Broadcast::connection()->getChannels()->get('dialog.{dialogId}');

    $this->assertNotNull($authorizer);
    $this->assertTrue($authorizer($guest, $channel->dialog_id));
  }

  public function test_non_member_cannot_authenticate_group_realtime_channel(): void {
    $guest = User::factory()->create();
    $group = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $authorizer = Broadcast::connection()->getChannels()->get('dialog.{dialogId}');

    $this->assertNotNull($authorizer);
    $this->assertFalse($authorizer($guest, $group->dialog_id));
  }

  public function test_channel_message_broadcast_reaches_members_and_current_guests(): void {
    Event::fake([DialogRealtimeEvent::class]);

    $owner = User::factory()->create();
    $channel = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $channel->users()->attach($owner->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $channel->id,
      'sender_id' => $owner->id,
    ]);

    DialogRealtime::message('dialog.message.created', $channel, $message);

    Event::assertDispatched(
      DialogRealtimeEvent::class,
      fn(DialogRealtimeEvent $event) => $event->broadcastAs() === 'dialog.message.created'
        && collect($event->broadcastOn())->pluck('name')->sort()->values()->all() === [
          "private-dialog.{$channel->dialog_id}",
          "private-user.{$owner->id}",
        ],
    );
  }

  public function test_channel_update_broadcasts_reach_current_guests(): void {
    Event::fake([DialogRealtimeEvent::class]);

    $owner = User::factory()->create();
    $channel = Dialog::factory()->create([
      'type' => DialogType::CHANNEL,
    ]);
    $channel->users()->attach($owner->id, [
      'role' => DialogMemberRole::OWNER->value,
    ]);

    DialogRealtime::messageDeleted($channel, 'message-id');
    DialogRealtime::membership($channel, 'joined', (string)$owner->id);

    foreach (['dialog.message.deleted', 'dialog.membership.changed'] as $eventName) {
      Event::assertDispatched(
        DialogRealtimeEvent::class,
        fn(DialogRealtimeEvent $event) => $event->broadcastAs() === $eventName
          && collect($event->broadcastOn())->pluck('name')->contains("private-dialog.{$channel->dialog_id}"),
      );
    }
  }

  public function test_group_message_broadcast_does_not_reach_non_members(): void {
    Event::fake([DialogRealtimeEvent::class]);

    $member = User::factory()->create();
    $group = Dialog::factory()->create([
      'type' => DialogType::GROUP,
    ]);
    $group->users()->attach($member->id, [
      'role' => DialogMemberRole::MEMBER->value,
    ]);
    $message = Message::factory()->create([
      'dialog_id' => $group->id,
      'sender_id' => $member->id,
    ]);

    DialogRealtime::message('dialog.message.created', $group, $message);

    Event::assertDispatched(
      DialogRealtimeEvent::class,
      fn(DialogRealtimeEvent $event) => $event->broadcastAs() === 'dialog.message.created'
        && collect($event->broadcastOn())->pluck('name')->all() === ["private-user.{$member->id}"],
    );
  }
}
