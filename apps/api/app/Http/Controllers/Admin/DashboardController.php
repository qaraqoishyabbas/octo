<?php

namespace App\Http\Controllers\Admin;

use App\Enums\DialogType;
use App\Http\Controllers\Controller;
use App\Models\Dialog;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller {
  public function __invoke(): Response {
    $startOfMonth = now()->startOfMonth();

    $usersCount = User::query()->count();
    $dialogsCount = Dialog::query()->count();
    $messagesCount = Message::query()->count();
    $activeUsersCount = User::query()
      ->whereHas('tokens', fn($query) => $query->where('last_used_at', '>=', now()->subDay()))
      ->count();

    $messageSeries = collect(range(11, 0))
      ->map(function (int $monthsAgo) {
        $date = now()->subMonths($monthsAgo);

        return [
          'label' => $date->format('M'),
          'value' => Message::query()
            ->whereBetween('created_at', [
              $date->copy()->startOfMonth(),
              $date->copy()->endOfMonth(),
            ])
            ->count(),
        ];
      })
      ->values();

    return Inertia::render('Dashboard', [
      'metrics' => [
        [
          'label' => 'Users',
          'value' => number_format($usersCount),
          'change' => '+' . number_format(User::query()->where('created_at', '>=', $startOfMonth)->count()) . ' this month',
          'icon' => 'users',
        ],
        [
          'label' => 'Dialogs',
          'value' => number_format($dialogsCount),
          'change' => $this->dialogTypeSummary(),
          'icon' => 'dialogs',
        ],
        [
          'label' => 'Messages',
          'value' => number_format($messagesCount),
          'change' => '+' . number_format(Message::query()->where('created_at', '>=', $startOfMonth)->count()) . ' this month',
          'icon' => 'messages',
        ],
        [
          'label' => 'Active users',
          'value' => number_format($activeUsersCount),
          'change' => 'Seen in the last 24 hours',
          'icon' => 'activity',
        ],
      ],
      'messageSeries' => $messageSeries,
      'pipeline' => [
        [
          'label' => 'Direct dialogs',
          'value' => number_format(Dialog::query()->where('type', DialogType::DIRECT->value)->count()),
          'icon' => 'direct',
        ],
        [
          'label' => 'Groups',
          'value' => number_format(Dialog::query()->where('type', DialogType::GROUP->value)->count()),
          'icon' => 'group',
        ],
        [
          'label' => 'Channels',
          'value' => number_format(Dialog::query()->where('type', DialogType::CHANNEL->value)->count()),
          'icon' => 'channel',
        ],
      ],
      'recentUsers' => User::query()
        ->latest()
        ->limit(5)
        ->get(['id', 'first_name', 'last_name', 'email', 'username', 'created_at'])
        ->map(fn(User $user) => [
          'id' => $user->id,
          'name' => trim($user->first_name . ' ' . $user->last_name) ?: $user->username,
          'email' => $user->email,
          'username' => $user->username,
          'created_at' => $user->created_at?->diffForHumans(),
        ]),
      'recentMessages' => Message::query()
        ->with(['sender:id,first_name,last_name,username,email', 'dialog:id,type,title'])
        ->latest()
        ->limit(5)
        ->get(['id', 'dialog_id', 'sender_id', 'message', 'created_at'])
        ->map(fn(Message $message) => [
          'id' => $message->id,
          'sender' => $message->sender
            ? (trim($message->sender->first_name . ' ' . $message->sender->last_name) ?: $message->sender->username)
            : 'System',
          'dialog' => $message->dialog?->title ?: $message->dialog?->dialog_id,
          'message' => str($message->message)->stripTags()->limit(80)->toString(),
          'created_at' => $message->created_at?->diffForHumans(),
        ]),
    ]);
  }

  private function dialogTypeSummary(): string {
    $groups = Dialog::query()->where('type', DialogType::GROUP->value)->count();
    $channels = Dialog::query()->where('type', DialogType::CHANNEL->value)->count();

    return "{$groups} groups, {$channels} channels";
  }
}
