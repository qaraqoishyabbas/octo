<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

class DeviceController extends Controller {
  /**
   * Get authenticated user devices
   */
  public function index(Request $request): JsonResponse {
    $user = $request->user();

    $currentToken = $user->currentAccessToken();

    $devices = $user->devices()
      ->with('token:id,name,last_used_at')
      ->get()
      ->sortByDesc(fn($device) => $device->token?->last_used_at)
      ->values()
      ->map(fn($device): array => [
        'key' => Crypt::encryptString($device->personal_access_token_id),
        'name' => $device->token->name,
        'ip' => $device->ip,
        'last_used_at' => $device->token->last_used_at,
        'is_current' => $currentToken->id === $device->personal_access_token_id,
        'is_bot' => $device->is_bot,
        'device' => [
          'type' => $device->device_type,
          'brand' => $device->device_brand,
          'model' => $device->device_model,
        ],
        'os' => [
          'name' => $device->os_name,
          'version' => $device->os_version,
          'platform' => $device->os_platform,
        ],
        'client' => [
          'type' => $device->client_type,
          'name' => $device->client_name,
          'version' => $device->client_version,
          'engine' => $device->client_engine,
          'engine_version' => $device->client_engine_version,
        ],
        'location' => [
          'country_code' => $device->country_code,
          'country_name' => $device->country_name,
          'region_code' => $device->region_code,
          'region_name' => $device->region_name,
          'city' => $device->city,
          'postal_code' => $device->postal_code,
          'timezone' => $device->timezone,
          'latitude' => $device->latitude,
          'longitude' => $device->longitude,
          'accuracy_radius' => $device->accuracy_radius,
        ],
      ]);

    return response()->json([
      'ok' => true,
      'devices' => $devices->toArray(),
    ]);
  }

  /**
   * Disconnect device by id
   */
  public function destroy(Request $request, string $id): JsonResponse {
    try {
      $tokenId = Crypt::decryptString($id);
    } catch (DecryptException) {
      abort(404);
    }

    $request->user()
      ->tokens()
      ->where('id', $tokenId)
      ->delete();

    return response()->json([
      'ok' => true,
    ]);
  }

  /**
   * Disconnect all other devices except current
   */
  public function destroyOthers(Request $request): JsonResponse {
    $currentToken = $request->user()->currentAccessToken();

    $request->user()
      ->tokens()
      ->where('id', '!=', $currentToken->id)
      ->delete();

    return response()->json([
      'ok' => true,
    ]);
  }
}
