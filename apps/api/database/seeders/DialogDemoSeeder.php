<?php

namespace Database\Seeders;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DialogDemoSeeder extends Seeder {
  use WithoutModelEvents;

  private const USERS_COUNT = 400;

  /**
   * Seed the application's database.
   */
  public function run(): void {
    $usersCount = self::USERS_COUNT;
    $users = User::factory($usersCount)->create();
    $userIds = $users->pluck('id')->values()->all();

    $profile = $this->buildSeedProfile($usersCount);

    $directPlans = $this->buildDirectDialogPlansByCount(
      $userIds,
      $profile['direct_min_per_user'],
      $profile['direct_max_per_user']
    );

    $groupPlans = $this->buildSharedDialogPlansByCount(
      $userIds,
      DialogType::GROUP,
      $profile['group_dialogs_count'],
      $profile['group_min_size'],
      $profile['group_max_size']
    );

    $channelPlans = $this->buildSharedDialogPlansByCount(
      $userIds,
      DialogType::CHANNEL,
      $profile['channel_dialogs_count'],
      $profile['channel_min_size'],
      $profile['channel_max_size']
    );

    $allPlans = array_merge($directPlans, $groupPlans, $channelPlans);
    shuffle($allPlans);

    $createdDialogs = [];

    foreach ($allPlans as $plan) {
      $dialog = Dialog::query()->create([
        'author_id' => $plan['author_id'],
        'title' => $plan['title'],
        'description' => $plan['description'],
        'type' => $plan['type'],
        'invite_token' => $this->randomInviteToken($plan['type']),
      ]);

      $dialog->users()->attach($this->buildMemberPivotRows($plan));
      $createdDialogs[] = [
        'dialog_id' => $dialog->id,
        'type' => $plan['type'],
        'members' => $plan['members'],
      ];
    }

    $this->seedMessagesForDialogs($createdDialogs);
    $this->seedPersonalAccessTokens($userIds);
  }

  /**
   * @return array{
   *     direct_min_per_user:int,
   *     direct_max_per_user:int,
   *     group_dialogs_count:int,
   *     channel_dialogs_count:int,
   *     group_min_size:int,
   *     group_max_size:int,
   *     channel_min_size:int,
   *     channel_max_size:int
   * }
   */
  private function buildSeedProfile(int $usersCount): array {
    $usersCount = max(1, $usersCount);
    $maxPeers = max(0, $usersCount - 1);
    $directMin = $maxPeers > 0 ? max(1, $this->percentCount($usersCount, 2, 1)) : 0;
    $directMax = $maxPeers > 0 ? max($directMin, $this->percentCount($usersCount, 5, 1)) : 0;
    $directMin = min($directMin, $maxPeers);
    $directMax = min($directMax, $maxPeers);

    return [
      // Для каждого пользователя: 2-5% личных диалогов от общего числа пользователей.
      'direct_min_per_user' => $directMin,
      'direct_max_per_user' => $directMax,
      // Групповые диалоги: 4-10% от количества пользователей.
      'group_dialogs_count' => $this->randomPercentCount($usersCount, 4, 10, 0),
      // Каналы: 10-12% от количества пользователей.
      'channel_dialogs_count' => $this->randomPercentCount($usersCount, 10, 12, 0),
      // Участники группы: 20-30% от общего количества пользователей.
      'group_min_size' => $this->percentCount($usersCount, 20, 2),
      'group_max_size' => $this->percentCount($usersCount, 30, 2),
      // Подписчики канала: 40-50% от общего количества пользователей.
      'channel_min_size' => $this->percentCount($usersCount, 40, 2),
      'channel_max_size' => $this->percentCount($usersCount, 50, 2),
    ];
  }

  private function percentCount(int $total, int $percent, int $min = 0): int {
    $value = (int)floor($total * $percent / 100);
    $value = max($min, $value);

    return min($total, $value);
  }

  private function randomPercentCount(int $total, int $minPercent, int $maxPercent, int $min = 0): int {
    if ($total <= 0) {
      return 0;
    }

    $minCount = $this->percentCount($total, $minPercent, $min);
    $maxCount = $this->percentCount($total, $maxPercent, $min);

    if ($maxCount < $minCount) {
      $maxCount = $minCount;
    }

    return random_int($minCount, $maxCount);
  }

  /**
   * @param array<int, string> $userIds
   */
  private function seedPersonalAccessTokens(array $userIds): void {
    $usersCount = count($userIds);

    if ($usersCount === 0) {
      return;
    }

    shuffle($userIds);

    $buckets = [
      'never' => 30,
      'more_than_month' => 10,
      'more_than_week' => 10,
      'more_than_today' => 10,
      'more_than_hour' => 10,
      'more_than_minute' => 10,
    ];

    $rows = [];
    $now = now();

    foreach ($buckets as $bucket => $percent) {
      $count = (int)floor($usersCount * $percent / 100);

      foreach (array_splice($userIds, 0, $count) as $userId) {
        $rows[] = $this->buildPersonalAccessTokenRow(
          $userId,
          $this->randomLastUsedAtForBucket($bucket, $now),
          $now
        );
      }
    }

    foreach ($userIds as $userId) {
      $rows[] = $this->buildPersonalAccessTokenRow(
        $userId,
        $this->randomLastUsedAtForBucket('online', $now),
        $now
      );
    }

    foreach (array_chunk($rows, 500) as $chunk) {
      PersonalAccessToken::query()->insert($chunk);
    }
  }

  private function randomLastUsedAtForBucket(string $bucket, Carbon $now): ?Carbon {
    return match ($bucket) {
      'never' => null,
      'more_than_month' => $now->copy()->subDays(random_int(31, 180))->setTime(
        random_int(0, 23),
        random_int(0, 59),
        random_int(0, 59)
      ),
      'more_than_week' => $now->copy()->subDays(random_int(8, 30))->setTime(
        random_int(0, 23),
        random_int(0, 59),
        random_int(0, 59)
      ),
      'more_than_today' => $now->copy()->subDays(random_int(1, 6))->setTime(
        random_int(0, 23),
        random_int(0, 59),
        random_int(0, 59)
      ),
      'more_than_hour' => $now->copy()->subMinutes(
        random_int(61, max(61, (int)$now->copy()->startOfDay()->diffInMinutes($now)))
      ),
      'more_than_minute' => $now->copy()->subMinutes(random_int(2, 59)),
      default => $now->copy(),
    };
  }

  private function buildPersonalAccessTokenRow(string $userId, ?Carbon $lastUsedAt, Carbon $now): array {
    return [
      'id' => (string)Str::uuid7(),
      'tokenable_type' => User::class,
      'tokenable_id' => $userId,
      'name' => fake()->randomElement(['iPhone', 'Android', 'Web', 'Desktop']),
      'token' => hash('sha256', Str::random(40)),
      'abilities' => json_encode(['*']),
      'last_used_at' => $lastUsedAt,
      'expires_at' => null,
      'created_at' => $now,
      'updated_at' => $now,
    ];
  }

  /**
   * Личные диалоги (1 на 1): у каждого пользователя заданный диапазон количества диалогов.
   *
   * @param array<int, string> $userIds
   * @return array<int, array{author_id:string,title:?string,description:?string,type:DialogType,members:array<int,string>}>
   */
  private function buildDirectDialogPlansByCount(array $userIds, int $minPerUser, int $maxPerUser): array {
    $usersCount = count($userIds);
    if ($usersCount < 2 || $maxPerUser <= 0) {
      return [];
    }

    $minPerUser = max(1, min($minPerUser, $usersCount - 1));
    $maxPerUser = max($minPerUser, min($maxPerUser, $usersCount - 1));

    $degrees = $this->randomGraphicalTargetMap($userIds, $minPerUser, $maxPerUser);
    $pairs = $this->buildEdgesByHavelHakimi($degrees);

    $plans = [];

    foreach ($pairs as [$a, $b]) {
      $plans[] = [
        'author_id' => $a,
        'title' => null,
        'description' => null,
        'type' => DialogType::DIRECT,
        'members' => [$a, $b],
      ];
    }

    return $plans;
  }

  /**
   * @param array<int, string> $userIds
   * @return array<string, int>
   */
  private function randomTargetMap(array $userIds, int $min, int $max): array {
    $targets = [];

    foreach ($userIds as $id) {
      $targets[$id] = random_int($min, $max);
    }

    return $targets;
  }

  /**
   * @param array<int, string> $userIds
   * @return array<string, int>
   */
  private function randomGraphicalTargetMap(array $userIds, int $min, int $max): array {
    for ($i = 0; $i < 500; $i++) {
      $degrees = $this->randomTargetMap($userIds, $min, $max);

      if (array_sum($degrees) % 2 !== 0) {
        $first = $userIds[0];
        $degrees[$first] = $degrees[$first] < $max ? $degrees[$first] + 1 : $degrees[$first] - 1;
      }

      if ($this->isGraphicalDegreeSequence(array_values($degrees))) {
        return $degrees;
      }
    }

    throw new \RuntimeException('Не удалось подобрать корректное распределение личных диалогов.');
  }

  /**
   * @param array<string, int> $degrees
   * @return array<int, array{0:string,1:string}>
   */
  private function buildEdgesByHavelHakimi(array $degrees): array {
    $nodes = [];
    foreach ($degrees as $id => $degree) {
      $nodes[] = ['id' => (string)$id, 'd' => $degree];
    }

    $edges = [];

    while (true) {
      usort($nodes, static fn(array $a, array $b): int => $b['d'] <=> $a['d']);

      if ($nodes[0]['d'] === 0) {
        break;
      }

      $head = array_shift($nodes);
      $u = $head['id'];
      $d = $head['d'];

      if ($d > count($nodes)) {
        throw new \RuntimeException('Некорректная степень для построения личных диалогов.');
      }

      for ($i = 0; $i < $d; $i++) {
        if ($nodes[$i]['d'] <= 0) {
          throw new \RuntimeException('Не удалось построить все личные диалоги по степеням.');
        }

        $v = $nodes[$i]['id'];
        $edges[] = [$u, $v];
        $nodes[$i]['d']--;
      }
    }

    return $edges;
  }

  /**
   * @param array<int, int> $degrees
   */
  private function isGraphicalDegreeSequence(array $degrees): bool {
    while (true) {
      rsort($degrees);

      if ($degrees[0] === 0) {
        return true;
      }

      $d = array_shift($degrees);

      if ($d < 0 || $d > count($degrees)) {
        return false;
      }

      for ($i = 0; $i < $d; $i++) {
        $degrees[$i]--;
        if ($degrees[$i] < 0) {
          return false;
        }
      }
    }
  }

  /**
   * Группы/каналы: создаются по фиксированному количеству диалогов.
   *
   * @param array<int, string> $userIds
   * @return array<int, array{author_id:string,title:string,description:string,type:DialogType,members:array<int,string>}>
   */
  private function buildSharedDialogPlansByCount(
    array      $userIds,
    DialogType $type,
    int        $dialogsCount,
    int        $minDialogSize,
    int        $maxDialogSize
  ): array {
    $usersCount = count($userIds);

    if ($usersCount < 2 || $dialogsCount <= 0) {
      return [];
    }

    $minDialogSize = max(2, min($minDialogSize, $usersCount));
    $maxDialogSize = max($minDialogSize, min($maxDialogSize, $usersCount));

    $plans = [];

    for ($i = 0; $i < $dialogsCount; $i++) {
      $pool = $userIds;
      shuffle($pool);

      $size = random_int($minDialogSize, $maxDialogSize);
      $members = array_slice($pool, 0, $size);
      $authorId = $members[array_rand($members)];

      $plans[] = [
        'author_id' => $authorId,
        'title' => $this->randomSharedDialogTitle($type),
        'description' => $this->randomSharedDialogDescription(),
        'type' => $type,
        'members' => $members,
      ];
    }

    return $plans;
  }

  private function randomSharedDialogTitle(DialogType $type): string {
    $name = Str::title((string)fake()->realText(fake()->numberBetween(20, 80)));

    return match ($type) {
      DialogType::GROUP => $name,
      DialogType::CHANNEL => $name,
      default => $name,
    };
  }

  private function randomSharedDialogDescription(): string {
    return (string)fake()->realText(fake()->numberBetween(50, 260));
  }

  /**
   * @param array{author_id:string,type:DialogType,members:array<int,string>} $plan
   * @return array<string, array{role:string,permissions:?string,muted:bool,pinned:bool,archived:bool,last_read_at:Carbon}>
   */
  private function buildMemberPivotRows(array $plan): array {
    $members = array_values(array_unique($plan['members']));
    $adminIds = $this->randomAdminIds($members, $plan['author_id'], $plan['type']);
    $rows = [];

    foreach ($members as $memberId) {
      $role = DialogMemberRole::MEMBER;
      $permissions = null;

      if ($plan['type'] !== DialogType::DIRECT && $memberId === $plan['author_id']) {
        $role = DialogMemberRole::OWNER;
        $permissions = DialogPermission::ownerDefaults();
      } elseif (in_array($memberId, $adminIds, true)) {
        $role = DialogMemberRole::ADMIN;
        $permissions = $this->randomAdminPermissions();
      }

      $rows[$memberId] = [
        'role' => $role->value,
        'permissions' => $permissions === null ? null : json_encode($permissions),
        'muted' => random_int(1, 100) <= 12,
        'pinned' => random_int(1, 100) <= 8,
        'archived' => random_int(1, 100) <= 4,
        'last_read_at' => now()->copy()->subDays(random_int(0, 4))->setTime(
          random_int(8, 23),
          random_int(0, 59),
          random_int(0, 59)
        ),
      ];
    }

    if ($plan['type'] !== DialogType::DIRECT && $rows) {
      $memberIds = array_keys($rows);
      $rows[$memberIds[array_rand($memberIds)]]['muted'] = true;
      $rows[$memberIds[array_rand($memberIds)]]['pinned'] = true;
      $rows[$memberIds[array_rand($memberIds)]]['archived'] = false;
    }

    return $rows;
  }

  /**
   * @param array<int, string> $members
   * @return array<int, string>
   */
  private function randomAdminIds(array $members, string $authorId, DialogType $type): array {
    if ($type === DialogType::DIRECT || count($members) < 3) {
      return [];
    }

    $candidates = array_values(array_filter(
      $members,
      static fn(string $memberId): bool => $memberId !== $authorId
    ));

    if (!$candidates) {
      return [];
    }

    shuffle($candidates);
    $maxAdmins = max(1, min(5, (int)floor(count($members) * 0.08)));
    $adminsCount = random_int(1, min($maxAdmins, count($candidates)));

    return array_slice($candidates, 0, $adminsCount);
  }

  /**
   * @return list<string>
   */
  private function randomAdminPermissions(): array {
    $permissions = DialogPermission::adminDefaults();
    shuffle($permissions);
    $min = min(2, count($permissions));

    return array_values(array_slice($permissions, 0, random_int($min, count($permissions))));
  }

  private function randomInviteToken(DialogType $type): ?string {
    if ($type === DialogType::DIRECT || random_int(1, 100) > 70) {
      return null;
    }

    return substr(str_replace('-', '', (string)Str::uuid()), 0, 16);
  }

  /**
   * @param array<int, array{dialog_id:string,type:DialogType,members:array<int,string>}> $dialogs
   */
  private function seedMessagesForDialogs(array $dialogs): void {
    foreach ($dialogs as $dialogData) {
      $dialogId = $dialogData['dialog_id'];
      $type = $dialogData['type'];
      $members = $dialogData['members'];
      $messagesCount = random_int(100, 300);
      $remaining = $messagesCount;
      $createdAtList = $this->buildMessageCreatedAtList($messagesCount);
      $createdAtIndex = 0;
      $createdMessageIds = [];
      $lastCreatedAt = null;

      while ($remaining > 0) {
        $batchSize = min($remaining, 500);
        $rows = [];

        for ($i = 0; $i < $batchSize; $i++) {
          $messageId = (string)Str::uuid7();
          $createdAt = $createdAtList[$createdAtIndex++] ?? now();
          $senderId = $this->randomMessageSenderId($members, $type);
          $replyToId = $senderId && $createdMessageIds && random_int(1, 100) <= 14
            ? $createdMessageIds[array_rand($createdMessageIds)]
            : null;
          $pinnedById = random_int(1, 100) <= 3
            ? $members[array_rand($members)]
            : null;
          $pinnedAt = $pinnedById ? $createdAt->copy()->addMinutes(random_int(1, 60)) : null;
          $updatedAt = random_int(1, 100) <= 8
            ? $createdAt->copy()->addMinutes(random_int(2, 120))
            : $createdAt;

          $rows[] = [
            'id' => $messageId,
            'dialog_id' => $dialogId,
            'sender_id' => $senderId,
            'reply_to_id' => $replyToId,
            'message' => $this->randomMessageText($members, $senderId, $type),
            'pinned_at' => $pinnedAt?->greaterThan(now()) ? now()->copy() : $pinnedAt,
            'pinned_by_id' => $pinnedById,
            'created_at' => $createdAt,
            'updated_at' => $updatedAt->greaterThan(now()) ? now()->copy() : $updatedAt,
          ];

          $createdMessageIds[] = $messageId;
          $lastCreatedAt = $createdAt;
        }

        Message::query()->insert($rows);
        $remaining -= $batchSize;
      }

      if ($lastCreatedAt) {
        $this->seedLastReadState($dialogId, $members, $lastCreatedAt);
      }
    }
  }

  /**
   * @param array<int, string> $members
   */
  private function randomMessageSenderId(array $members, DialogType $type): ?string {
    if ($type === DialogType::GROUP && random_int(1, 100) <= 3) {
      return null;
    }

    return $members[array_rand($members)];
  }

  /**
   * @param array<int, string> $members
   */
  private function randomMessageText(array $members, ?string $senderId, DialogType $type): string {
    if ($senderId === null) {
      return '<p>' . fake()->randomElement([
          'К диалогу присоединились новые участники',
          'Настройки диалога были обновлены',
          'Описание диалога изменено',
        ]) . '</p>';
    }

    $text = fake()->realText(random_int(40, 240));

    if ($type !== DialogType::DIRECT && count($members) > 1 && random_int(1, 100) <= 10) {
      $mentionCandidates = array_values(array_filter(
        $members,
        static fn(string $memberId): bool => $memberId !== $senderId
      ));
      $mentionedUserId = $mentionCandidates[array_rand($mentionCandidates)];

      return '<p>' . e($text) . ' <span class="message-mention" data-type="mention" data-id="' . e($mentionedUserId) . '" data-label="участник">участник</span></p>';
    }

    return $text;
  }

  /**
   * @param array<int, string> $members
   */
  private function seedLastReadState(string $dialogId, array $members, Carbon $lastCreatedAt): void {
    foreach ($members as $memberId) {
      if (random_int(1, 100) <= 12) {
        continue;
      }

      $readAt = random_int(1, 100) <= 72
        ? $lastCreatedAt->copy()->subMinutes(random_int(0, 360))
        : $lastCreatedAt->copy();

      DB::table('dialog_user')
        ->where('dialog_id', $dialogId)
        ->where('user_id', $memberId)
        ->update([
          'last_read_at' => $readAt->lessThan(now()->subDays(5)) ? now()->subDays(5) : $readAt,
        ]);
    }
  }

  /**
   * @return array<int, Carbon>
   */
  private function buildMessageCreatedAtList(int $messagesCount): array {
    $daysAgo = [4, 3, 2, 1, 0];
    $daysCount = count($daysAgo);
    $baseCount = intdiv($messagesCount, $daysCount);
    $remainder = $messagesCount % $daysCount;
    $timestamps = [];

    foreach ($daysAgo as $index => $dayAgo) {
      $messagesForDay = $baseCount + ($index < $remainder ? 1 : 0);
      $dayMessages = [];

      for ($i = 0; $i < $messagesForDay; $i++) {
        $messageCreatedAt = now()
          ->subDays($dayAgo)
          ->setTime(
            random_int(8, 23),
            random_int(0, 59),
            random_int(0, 59)
          );

        $dayMessages[] = $messageCreatedAt->greaterThan(now())
          ? now()->copy()
          : $messageCreatedAt;
      }

      usort($dayMessages, static fn($a, $b): int => $a->timestamp <=> $b->timestamp);
      array_push($timestamps, ...$dayMessages);
    }

    return $timestamps;
  }
}
