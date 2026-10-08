<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\DialogController;
use App\Http\Controllers\Api\GroupController;
use App\Http\Controllers\Api\MessageAttachmentController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NotificationAppController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\PushTokenController;
use App\Http\Controllers\Api\RealtimeController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UserController;
use App\Http\Middleware\EnsureBearerToken;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
  return response()->json([
    'status' => 'success',
    'message' => 'API is operational',
    'version' => '1.0.0',
    'environment' => app()->environment(),
    'timestamp' => now()->toIso8601String(),
  ], 200);
});

Route::prefix('v1')->group(function () {
  Route::post('login', [AuthController::class, 'login'])->middleware(['throttle:login'])->name('login');

  Route::middleware([EnsureBearerToken::class, 'auth:sanctum'])->group(function () {

    Route::get('notification-apps', [NotificationAppController::class, 'index']);
    Route::post('notification-apps', [NotificationAppController::class, 'store']);
    Route::get('notification-apps/{id}', [NotificationAppController::class, 'show']);
    Route::get('notification-apps/{id}/public-config', [NotificationAppController::class, 'publicConfig']);
    Route::patch('notification-apps/{id}', [NotificationAppController::class, 'update']);
    Route::delete('notification-apps/{id}', [NotificationAppController::class, 'destroy']);
    Route::put('notification-apps/{id}/credentials', [NotificationAppController::class, 'credentials']);
    Route::delete('notification-apps/{id}/credentials/{provider}', [NotificationAppController::class, 'deleteCredentials']);
    Route::post('notification-apps/{id}/notifications', [NotificationAppController::class, 'send']);
    Route::get('notification-apps/{id}/deliveries', [NotificationAppController::class, 'deliveries']);
    Route::get('push-tokens', [PushTokenController::class, 'index']);
    Route::post('push-tokens', [PushTokenController::class, 'store']);
    Route::delete('push-tokens/{id}', [PushTokenController::class, 'destroy']);
    Route::get('notification-preferences', [NotificationPreferenceController::class, 'show']);
    Route::patch('notification-preferences', [NotificationPreferenceController::class, 'update']);

    Route::get('/devices', [DeviceController::class, 'index'])->name('devices');
    Route::delete('/devices/{id}', [DeviceController::class, 'destroy'])->name('devices.disconnect');
    Route::delete('/devices', [DeviceController::class, 'destroyOthers'])->name('devices.disconnect.other');

    Route::post('logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('users', [UserController::class, 'index'])->name('users.index');

    Route::post('/account/update', [AccountController::class, 'update'])->name('account.update');
    Route::post('/account/username', [AccountController::class, 'updateUsername'])->name('account.username.update');
    Route::post('/account/birth-date', [AccountController::class, 'updateBirthDate'])->name('account.birth-date.update');
    Route::get('me', [AccountController::class, 'me'])->name('account');
    Route::patch('realtime/heartbeat', [RealtimeController::class, 'heartbeat'])->name('realtime.heartbeat');
    Route::patch('realtime/typing', [RealtimeController::class, 'typing'])->name('realtime.typing');
    Route::post('upload', [UploadController::class, 'image'])->name('upload.image');
    Route::delete('upload/{upload}', [UploadController::class, 'destroy'])->name('upload.destroy');

    Route::get('dialogs', [DialogController::class, 'index'])->name('dialogs.index');
    Route::get('dialogs/{target}/users', [DialogController::class, 'users'])->name('dialog.users');
    Route::get('dialogs/{target}/attachments', [DialogController::class, 'attachments'])->name('dialog.attachments');
    Route::get('dialogs/{target}/links', [DialogController::class, 'links'])->name('dialog.links');
    Route::post('dialogs/{target}/users', [DialogController::class, 'addUsers'])->name('dialog.users.add');
    Route::delete('dialogs/{target}/users/{user}', [DialogController::class, 'removeUser'])->name('dialog.users.remove');
    Route::post('dialogs/{target}/join', [DialogController::class, 'join'])->name('dialog.join');
    Route::delete('dialogs/{target}/leave', [DialogController::class, 'leave'])->name('dialog.leave');
    Route::patch('dialogs/{target}/users/{user}/role', [DialogController::class, 'updateUserRole'])->name('dialog.users.role.update');
    Route::get('dialogs/{target}/groups', [DialogController::class, 'groups'])->name('dialog.groups');
    Route::get('dialogs/{target}', [DialogController::class, 'show'])->name('dialog.show');
    Route::patch('dialogs/{target}', [DialogController::class, 'update'])->name('dialog.update');
    Route::post('dialogs/{target}/invite-link', [DialogController::class, 'inviteLink'])->name('dialog.invite-link');
    Route::get('invites/{token}', [DialogController::class, 'invite'])->name('dialog.invite');
    Route::post('invites/{token}/join', [DialogController::class, 'joinByInvite'])->name('dialog.invite.join');
    Route::patch('dialogs/{target}/mute', [DialogController::class, 'mute'])->name('dialog.mute');
    Route::patch('dialogs/{target}/pin', [DialogController::class, 'pin'])->name('dialog.pin');
    Route::patch('dialogs/{target}/archive', [DialogController::class, 'archive'])->name('dialog.archive');
    Route::patch('dialogs/{target}/read', [DialogController::class, 'read'])->name('dialog.read');

    Route::get('messages', [MessageController::class, 'index'])->name('messages');
    Route::post('messages', [MessageController::class, 'store'])->name('messages.store');
    Route::get('messages/search', [MessageController::class, 'search'])->name('messages.search');
    Route::get('messages/pinned', [MessageController::class, 'pinned'])->name('messages.pinned');
    Route::patch('messages/{message}/pin', [MessageController::class, 'pin'])->name('messages.pin');
    Route::patch('messages/{message}', [MessageController::class, 'update'])->name('messages.update');
    Route::delete('messages/{message}', [MessageController::class, 'destroy'])->name('messages.destroy');
    Route::get('attachments/{attachment}/download', [MessageAttachmentController::class, 'download'])
      ->name('attachments.download');

    Route::get('channels', [ChannelController::class, 'index'])->name('channels.index');
    Route::post('channel', [ChannelController::class, 'store'])->name('channel.store');
    Route::post('group', [GroupController::class, 'store'])->name('group.store');

  });
});
