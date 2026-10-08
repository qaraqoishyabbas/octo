<?php

namespace Tests\Unit;

use App\Helpers\MessageText;
use App\Models\User;
use Tests\TestCase;

class MessageTextTest extends TestCase {
  public function test_mentions_use_the_stable_user_id(): void {
    $user = new User([
      'first_name' => 'Orange',
      'last_name' => 'User',
      'username' => 'orange',
    ]);
    $user->id = '00000000-0000-0000-0000-000000000123';

    $this->assertSame(
      '[@ id="00000000-0000-0000-0000-000000000123" label="Orange User"]',
      MessageText::mention($user),
    );
  }
}
