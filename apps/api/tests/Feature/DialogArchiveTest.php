<?php

namespace Tests\Feature;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DialogArchiveTest extends TestCase {
  use RefreshDatabase;

  public function test_user_can_archive_dialog(): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $dialog = Dialog::factory()->create([
      'type' => DialogType::DIRECT,
    ]);
    $dialog->users()->sync([
      $user->id => ['role' => DialogMemberRole::MEMBER->value],
      $other->id => ['role' => DialogMemberRole::MEMBER->value],
    ]);
    $token = $user->createToken('Test device')->plainTextToken;

    $this
      ->withToken($token)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.archived', false);

    $this
      ->withToken($token)
      ->patchJson("/api/v1/dialogs/{$dialog->dialog_id}/archive")
      ->assertOk()
      ->assertJsonPath('ok', true)
      ->assertJsonPath('archived', true);

    $this->assertTrue((bool)DB::table('dialog_user')
      ->where('dialog_id', $dialog->id)
      ->where('user_id', $user->id)
      ->value('archived'));

    $this
      ->withToken($token)
      ->getJson('/api/v1/dialogs')
      ->assertOk()
      ->assertJsonPath('dialogs.0.archived', true);
  }
}
