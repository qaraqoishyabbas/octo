<?php

use App\Enums\DialogType;
use App\Models\Dialog;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
  return (string)$user->id === (string)$id;
});

Broadcast::channel('user.{id}', function ($user, $id) {
  return (string)$user->id === (string)$id;
});

Broadcast::channel('call.{roomId}', function ($user, string $roomId) {
  return (bool)$user && filled($roomId);
});

Broadcast::channel('dialog.{dialogId}', function ($user, string $dialogId) {
  $parts = Dialog::parseDialogId($dialogId);

  if (!$parts) {
    return false;
  }

  if ($parts['type'] === DialogType::CHANNEL->value) {
    return Dialog::query()
      ->where('dialogs.type', DialogType::CHANNEL)
      ->where('dialogs.id', $parts['id'])
      ->exists();
  }

  $query = $user->dialogs()
    ->select(Dialog::columns())
    ->where('dialogs.type', $parts['type']);

  if ($parts['type'] === DialogType::DIRECT->value && $parts['id'] === $user->id) {
    $query->where(fn($directQuery) => $directQuery
      ->where('dialogs.id', $parts['id'])
      ->orWhereDoesntHave('users', fn($userQuery) => $userQuery
        ->where('users.id', '!=', $user->id)));
  } elseif ($parts['type'] === DialogType::DIRECT->value) {
    $query->where(fn($directQuery) => $directQuery
      ->where('dialogs.id', $parts['id'])
      ->orWhereHas('users', fn($userQuery) => $userQuery
        ->where('users.id', '!=', $user->id)
        ->where('users.id', $parts['id'])));
  } else {
    $query->where('dialogs.id', $parts['id']);
  }

  return $query->exists();
});
