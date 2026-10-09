<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationApp;
use App\Services\NotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Minishlink\WebPush\VAPID;

class NotificationAppController extends Controller {
  public function index(): Response {
    $apps = NotificationApp::query()
      ->withCount('pushTokens')
      ->with('credentials:id,notification_app_id,provider,updated_at')
      ->latest()
      ->paginate(20)
      ->through(fn(NotificationApp $app): array => [
        'id' => $app->id,
        'name' => $app->name,
        'platform' => $app->platform,
        'enabled' => $app->enabled,
        'push_tokens_count' => $app->push_tokens_count,
        'credentials' => $app->credentials->map(fn($item): array => [
          'provider' => $item->provider,
          'updated_at' => $item->updated_at?->format('Y-m-d H:i'),
        ])->values()->all(),
        'created_at' => $app->created_at?->format('Y-m-d H:i'),
      ]);

    return Inertia::render('Notifications/Index', ['apps' => $apps]);
  }

  public function store(Request $request): RedirectResponse {
    $data = $request->validate([
      'name' => ['required', 'string', 'max:100'],
      'platform' => ['required', Rule::in(['web', 'android', 'ios', 'desktopapp'])],
    ]);
    NotificationApp::query()->create([...$data, 'owner_id' => $request->user()->id]);
    return redirect()->route('web.notification-apps.index')->with('success', 'Приложение создано.');
  }

  public function update(Request $request, NotificationApp $app): RedirectResponse {
    $data = $request->validate([
      'name' => ['sometimes', 'required', 'string', 'max:100'],
      'enabled' => ['sometimes', 'required', 'boolean'],
    ]);
    $app->update($data);
    return back()->with('success', 'Приложение обновлено.');
  }

  public function destroy(NotificationApp $app): RedirectResponse {
    $app->delete();
    return redirect()->route('web.notification-apps.index')->with('success', 'Приложение удалено.');
  }

  public function credentials(Request $request, NotificationApp $app, string $provider): RedirectResponse {
    if (!in_array($provider, NotificationService::providersFor($app->platform), true)) {
      throw ValidationException::withMessages(['provider' => 'Провайдер не подходит для платформы приложения.']);
    }

    $required = NotificationService::credentialFieldsFor($provider);
    $rules = collect($required)->mapWithKeys(fn($field) => [$field => ['required', 'string', 'max:10000']])->all();
    if ($provider === 'apns') {
      $rules['sandbox'] = ['sometimes', 'boolean'];
    }
    $data = Validator::make($request->all(), $rules)->validate();
    if ($provider === 'apns') {
      $data['sandbox'] = (bool)($data['sandbox'] ?? false);
    }
    $app->credentials()->updateOrCreate(['provider' => $provider], ['credentials' => $data]);

    return back()->with('success', 'Credentials сохранены.');
  }

  public function generateVapidKeys(NotificationApp $app): JsonResponse {
    if (!in_array('webpush', NotificationService::providersFor($app->platform), true)) {
      throw ValidationException::withMessages(['provider' => 'VAPID доступен только для Web Push.']);
    }

    $keys = VAPID::createVapidKeys();

    return response()->json([
      'public_key' => $keys['publicKey'],
      'private_key' => $keys['privateKey'],
    ])->header('Cache-Control', 'no-store, private');
  }

  public function deleteCredentials(NotificationApp $app, string $provider): RedirectResponse {
    $app->credentials()->where('provider', $provider)->delete();
    return back()->with('success', 'Credentials удалены.');
  }
}
