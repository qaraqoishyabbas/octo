<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelIndexTest extends TestCase {
  use RefreshDatabase;

  public function test_channels_can_be_searched_by_title_and_are_sorted_by_subscriber_count(): void {
    $me = User::factory()->create();
    $subscribers = User::factory()->count(3)->create();

    $popular = Dialog::factory()->create([
      'title' => 'Alpha News',
      'type' => DialogType::CHANNEL,
    ]);
    $quiet = Dialog::factory()->create([
      'title' => 'Alpha Local',
      'type' => DialogType::CHANNEL,
    ]);
    $unmatched = Dialog::factory()->create([
      'title' => 'Beta News',
      'type' => DialogType::CHANNEL,
    ]);
    $group = Dialog::factory()->create([
      'title' => 'Alpha Group',
      'type' => DialogType::GROUP,
    ]);

    $popular->users()->attach($subscribers->pluck('id'), [
      'role' => DialogMemberRole::MEMBER->value,
    ]);
    $quiet->users()->attach($subscribers->first()->id, [
      'role' => DialogMemberRole::MEMBER->value,
    ]);
    $group->users()->attach($subscribers->pluck('id'), [
      'role' => DialogMemberRole::MEMBER->value,
    ]);

    $response = $this
      ->withToken($me->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/channels?q=alpha&per_page=10')
      ->assertOk()
      ->assertJsonPath('total', 2)
      ->assertJsonPath('has_more', false);

    $this->assertSame([
      $popular->id,
      $quiet->id,
    ], array_column($response->json('channels'), 'id'));
    $this->assertSame([3, 1], array_column($response->json('channels'), 'users_count'));

    $this->assertNotContains($unmatched->id, array_column($response->json('channels'), 'id'));
    $this->assertNotContains($group->id, array_column($response->json('channels'), 'id'));
  }
}
