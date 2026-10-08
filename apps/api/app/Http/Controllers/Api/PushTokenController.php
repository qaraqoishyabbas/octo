<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationApp;
use App\Models\PushToken;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PushTokenController extends Controller {
  public function index(Request $request): JsonResponse {
    return response()->json(['ok' => true, 'data' => PushToken::query()
      ->where('user_id', $request->user()->id)
      ->with('app:id,name,platform')
      ->latest()->get()]);
  }

  public function store(Request $request): JsonResponse {
    $data = $request->validate([
      'app_id' => ['required', 'uuid', 'exists:notification_apps,id'],
      'token' => ['required', 'string', 'max:8192'],
      'provider' => ['nullable', 'string'],
      'metadata' => ['nullable', 'array'],
    ]);
    $app = NotificationApp::query()->findOrFail($data['app_id']);
    if (!$app->enabled) {
      throw ValidationException::withMessages(['app_id' => 'Application is disabled.']);
    }
    $provider = $data['provider'] ?? NotificationService::providersFor($app->platform)[0];
    if (!in_array($provider, NotificationService::providersFor($app->platform), true)) {
      throw ValidationException::withMessages(['provider' => 'Provider is not available for this platform.']);
    }

    if ($app->platform === 'web' || $app->platform === 'desktopapp') {
      $subscription = json_decode($data['token'], true);
      $endpoint = is_array($subscription) ? ($subscription['endpoint'] ?? null) : null;
      $host = is_string($endpoint) ? strtolower((string)parse_url($endpoint, PHP_URL_HOST)) : '';
      $trustedHosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
      $trusted = in_array($host, $trustedHosts, true) || str_ends_with($host, '.notify.windows.com');
      if (!is_array($subscription) || !is_string($endpoint) || !str_starts_with($endpoint, 'https://')
        || !$trusted || !filter_var($endpoint, FILTER_VALIDATE_URL)
        || !is_string($subscription['keys']['p256dh'] ?? null)
        || !is_string($subscription['keys']['auth'] ?? null)) {
        throw ValidationException::withMessages(['token' => 'Invalid Web Push subscription.']);
      }
    }

    $hash = hash('sha256', $provider . "\0" . $data['token']);
    $existing = PushToken::query()->where('notification_app_id', $app->id)->where('token_hash', $hash)->first();
    $created = !$existing;
    $token = $existing ?? new PushToken();
    $token->fill([
      'notification_app_id' => $app->id,
      'user_id' => $request->user()->id,
      'personal_access_token_id' => $request->user()->currentAccessToken()?->id,
      'provider' => $provider,
      'token_hash' => $hash,
      'token' => $data['token'],
      'metadata' => $data['metadata'] ?? null,
      'last_seen_at' => now(),
    ]);
    $token->save();

    return response()->json(['ok' => true, 'data' => $token], $created ? 201 : 200);
  }

  public function destroy(Request $request, string $id): JsonResponse {
    PushToken::query()->where('user_id', $request->user()->id)->findOrFail($id)->delete();
    return response()->json(['ok' => true]);
  }
}
