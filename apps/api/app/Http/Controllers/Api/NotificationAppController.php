<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationApp;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Validator;

class NotificationAppController extends Controller {
  public function index(Request $request): JsonResponse {
    return response()->json(['ok' => true, 'data' => NotificationApp::query()
      ->where('owner_id', $request->user()->id)
      ->with('credentials:id,notification_app_id,provider,updated_at')
      ->orderBy('name')->get()]);
  }

  public function store(Request $request): JsonResponse {
    $data = $request->validate([
      'name' => ['required', 'string', 'max:100'],
      'platform' => ['required', Rule::in(['web', 'android', 'ios', 'desktopapp'])],
    ]);
    $app = NotificationApp::query()->create([...$data, 'owner_id' => $request->user()->id]);

    return response()->json(['ok' => true, 'data' => $app], 201);
  }

  public function show(Request $request, string $id): JsonResponse {
    $app = $this->owned($request, $id);
    return response()->json(['ok' => true, 'data' => $app->load('credentials:id,notification_app_id,provider,updated_at')]);
  }

  public function publicConfig(string $id): JsonResponse {
    $app = NotificationApp::query()->where('enabled', true)->findOrFail($id);
    $webpush = $app->credentials()->where('provider', 'webpush')->first();
    return response()->json(['ok' => true, 'data' => [
      'id' => $app->id,
      'platform' => $app->platform,
      'public_key' => $webpush?->credentials['public_key'] ?? null,
    ]]);
  }

  public function update(Request $request, string $id): JsonResponse {
    $app = $this->owned($request, $id);
    $data = $request->validate([
      'name' => ['sometimes', 'required', 'string', 'max:100'],
      'enabled' => ['sometimes', 'required', 'boolean'],
    ]);
    $app->update($data);
    return response()->json(['ok' => true, 'data' => $app]);
  }

  public function destroy(Request $request, string $id): JsonResponse {
    $this->owned($request, $id)->delete();
    return response()->json(['ok' => true]);
  }

  public function credentials(Request $request, string $id): JsonResponse {
    $app = $this->owned($request, $id);
    $data = $request->validate([
      'provider' => ['required', Rule::in(NotificationService::providersFor($app->platform))],
      'credentials' => ['required', 'array'],
    ]);
    $required = NotificationService::credentialFieldsFor($data['provider']);
    Validator::make($data['credentials'], collect($required)
      ->mapWithKeys(fn($field) => [$field => ['required', 'string', 'max:10000']])->all())->validate();
    $credential = $app->credentials()->updateOrCreate(
      ['provider' => $data['provider']],
      ['credentials' => $data['credentials']],
    );
    return response()->json(['ok' => true, 'data' => $credential->only(['id', 'provider', 'updated_at'])]);
  }

  public function deleteCredentials(Request $request, string $id, string $provider): JsonResponse {
    $this->owned($request, $id)->credentials()->where('provider', $provider)->delete();
    return response()->json(['ok' => true]);
  }

  public function send(Request $request, string $id, NotificationService $service): JsonResponse {
    $app = $this->owned($request, $id);
    $data = $request->validate([
      'user_ids' => ['required', 'array', 'min:1', 'max:1000'],
      'user_ids.*' => ['required', 'uuid', 'exists:users,id'],
      'title' => ['required', 'string', 'max:200'],
      'body' => ['required', 'string', 'max:4000'],
      'data' => ['nullable', 'array'],
    ]);
    $count = $service->sendToUsers($app, $data['user_ids'], $data['title'], $data['body'], $data['data'] ?? []);
    return response()->json(['ok' => true, 'data' => ['queued' => $count]], 201);
  }

  public function deliveries(Request $request, string $id): JsonResponse {
    $app = $this->owned($request, $id);
    return response()->json(['ok' => true, 'data' => $app->deliveries()->latest()->paginate(30)]);
  }

  private function owned(Request $request, string $id): NotificationApp {
    return NotificationApp::query()->where('owner_id', $request->user()->id)->findOrFail($id);
  }
}
