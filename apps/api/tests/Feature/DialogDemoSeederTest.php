<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use Database\Seeders\DialogDemoSeeder;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class DialogDemoSeederTest extends TestCase {
  protected function tearDown(): void {
    Carbon::setTestNow();

    parent::tearDown();
  }

  public function test_shared_dialog_members_are_seeded_with_live_pivot_state(): void {
    Carbon::setTestNow(Carbon::parse('2026-06-11 12:00:00'));

    $seeder = new DialogDemoSeeder();
    $method = new \ReflectionMethod($seeder, 'buildMemberPivotRows');
    $method->setAccessible(true);

    $rows = $method->invoke($seeder, [
      'author_id' => 'user-owner',
      'type' => DialogType::GROUP,
      'members' => ['user-owner', 'user-admin', 'user-member'],
    ]);

    $this->assertSame(DialogMemberRole::OWNER->value, $rows['user-owner']['role']);
    $this->assertSame(DialogPermission::ownerDefaults(), json_decode($rows['user-owner']['permissions'], true));

    $this->assertContains(DialogMemberRole::ADMIN->value, [
      $rows['user-admin']['role'],
      $rows['user-member']['role'],
    ]);

    $this->assertContains(true, array_column($rows, 'muted'));
    $this->assertContains(true, array_column($rows, 'pinned'));
    $this->assertContains(false, array_column($rows, 'archived'));
    $this->assertContainsOnlyInstancesOf(Carbon::class, array_column($rows, 'last_read_at'));
  }
}
