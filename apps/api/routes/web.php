<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DialogController;
use App\Http\Controllers\Admin\NotificationAppController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
  Route::get('/login', [AuthController::class, 'create'])->name('web.login');
  Route::post('/login', [AuthController::class, 'store'])->name('web.login.store');
});

Route::middleware('auth')->group(function () {
  Route::get('/', DashboardController::class)->name('home');
  Route::get('/dashboard', DashboardController::class)->name('dashboard');
  Route::post('/logout', [AuthController::class, 'destroy'])->name('web.logout');

  Route::get('/users', [UserController::class, 'index'])->name('web.users.index');
  Route::get('/users/create', [UserController::class, 'create'])->name('web.users.create');
  Route::post('/users', [UserController::class, 'store'])->name('web.users.store');
  Route::put('/users/{user}', [UserController::class, 'update'])->name('web.users.update');
  Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('web.users.destroy');

  Route::get('/notification-apps', [NotificationAppController::class, 'index'])->name('web.notification-apps.index');
  Route::post('/notification-apps', [NotificationAppController::class, 'store'])->name('web.notification-apps.store');
  Route::patch('/notification-apps/{app}', [NotificationAppController::class, 'update'])->name('web.notification-apps.update');
  Route::delete('/notification-apps/{app}', [NotificationAppController::class, 'destroy'])->name('web.notification-apps.destroy');
  Route::put('/notification-apps/{app}/credentials/{provider}', [NotificationAppController::class, 'credentials'])->name('web.notification-apps.credentials');
  Route::delete('/notification-apps/{app}/credentials/{provider}', [NotificationAppController::class, 'deleteCredentials'])->name('web.notification-apps.credentials.destroy');

  Route::get('/channels', [DialogController::class, 'channels'])->name('web.channels.index');
  Route::get('/groups', [DialogController::class, 'groups'])->name('web.groups.index');
  Route::post('/dialogs/{type}', [DialogController::class, 'store'])->name('web.dialogs.store');
  Route::put('/dialogs/{dialog}', [DialogController::class, 'update'])->name('web.dialogs.update');
  Route::delete('/dialogs/{dialog}', [DialogController::class, 'destroy'])->name('web.dialogs.destroy');
  Route::put('/dialogs/{dialog}/owner', [DialogController::class, 'setOwner'])->name('web.dialogs.owner');
  Route::post('/dialogs/{dialog}/members', [DialogController::class, 'storeMember'])->name('web.dialogs.members.store');
  Route::put('/dialogs/{dialog}/members/{user}', [DialogController::class, 'updateMember'])->name('web.dialogs.members.update');
  Route::delete('/dialogs/{dialog}/members/{user}', [DialogController::class, 'destroyMember'])->name('web.dialogs.members.destroy');
});

Route::get('/health', function () {
  return response()->json([
    'status' => 'success',
    'message' => 'APP is operational',
    'version' => '1.0.0',
    'environment' => app()->environment(),
    'timestamp' => now()->toIso8601String(),
  ], 200);
});
