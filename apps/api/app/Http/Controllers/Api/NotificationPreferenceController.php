<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller {
  public function show(Request $request): JsonResponse {
    $preference = NotificationPreference::query()->firstOrCreate(['user_id' => $request->user()->id]);
    return response()->json(['ok' => true, 'data' => $preference]);
  }

  public function update(Request $request): JsonResponse {
    $data = $request->validate([
      'enabled' => ['sometimes', 'boolean'],
      'sound' => ['sometimes', 'boolean'],
      'badge' => ['sometimes', 'boolean'],
      'mentions_in_muted' => ['sometimes', 'boolean'],
      'show_text' => ['sometimes', 'boolean'],
      'show_names' => ['sometimes', 'boolean'],
    ]);
    $preference = NotificationPreference::query()->firstOrCreate(['user_id' => $request->user()->id]);
    $preference->update($data);
    return response()->json(['ok' => true, 'data' => $preference]);
  }
}
