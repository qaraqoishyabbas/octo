<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class UserIndexTest extends TestCase {
  use RefreshDatabase;

  public function test_users_are_sorted_by_last_seen_by_default(): void {
    $me = User::factory()->create(['id' => '00000000-0000-0000-0000-000000000001']);
    $old = User::factory()->create(['id' => '00000000-0000-0000-0000-000000000002']);
    $recent = User::factory()->create(['id' => '00000000-0000-0000-0000-000000000003']);
    $never = User::factory()->create(['id' => '00000000-0000-0000-0000-000000000004']);

    $old->createToken('Old device')->accessToken->forceFill([
      'last_used_at' => Carbon::parse('2026-01-01 10:00:00'),
    ])->save();
    $recent->createToken('Recent device')->accessToken->forceFill([
      'last_used_at' => Carbon::parse('2026-02-01 10:00:00'),
    ])->save();

    $response = $this
      ->withToken($me->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/users?per_page=10')
      ->assertOk();

    $this->assertSame([
      $recent->id,
      $old->id,
      $never->id,
    ], array_column($response->json('users'), 'id'));
  }

  public function test_users_can_be_sorted_by_name_across_pages(): void {
    $me = User::factory()->create(['id' => '00000000-0000-0000-0000-000000000001']);
    $charlie = User::factory()->create([
      'id' => '00000000-0000-0000-0000-000000000003',
      'first_name' => 'Charlie',
      'last_name' => 'User',
    ]);
    $bravo = User::factory()->create([
      'id' => '00000000-0000-0000-0000-000000000002',
      'first_name' => 'Bravo',
      'last_name' => 'User',
    ]);
    User::factory()->create([
      'id' => '00000000-0000-0000-0000-000000000004',
      'first_name' => 'Alpha',
      'last_name' => 'User',
    ]);

    $response = $this
      ->withToken($me->createToken('Test device')->plainTextToken)
      ->getJson('/api/v1/users?sort_by=name&per_page=2&page=2')
      ->assertOk()
      ->assertJsonPath('has_more', false);

    $this->assertSame([
      $charlie->id,
    ], array_column($response->json('users'), 'id'));
  }
}
