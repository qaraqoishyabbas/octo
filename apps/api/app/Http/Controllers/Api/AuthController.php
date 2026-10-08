<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DeviceDetailsResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller {
  /**
   * Login user
   * @throws ValidationException
   */
  public function login(Request $request, DeviceDetailsResolver $deviceDetails): JsonResponse {
    $request->validate([
      'username' => ['required', 'string'],
      'password' => ['required', 'string'],
    ]);

    $user = User::where('username', $request->input('username'))->first();

    if (!$user || !Hash::check($request->input('password'), $user->password)) {
      throw ValidationException::withMessages([
        'username' => __('auth.failed'),
      ]);
    }

    $remember = $request->boolean('remember');
    $details = $deviceDetails->resolve($request->userAgent(), $request->ip());
    $deviceName = $details['name'];
    unset($details['name']);

    $plainTextToken = DB::transaction(function () use ($user, $deviceName, $details, $remember): string {
      $sanctumToken = $user->createToken(
        $deviceName,
        ['*'],
        $remember ?
          now()->addMonth() :
          now()->addDay()
      );

      $sanctumToken->accessToken->device()->create([
        ...$details,
        'user_id' => $user->id,
      ]);

      return $sanctumToken->plainTextToken;
    });

    return response()->json([
      'ok' => true,
      'token' => $plainTextToken,
    ]);
  }

  /**
   * Revoke token; only remove token that is used to perform logout (i.e. will not revoke all tokens)
   */
  public function logout(Request $request): JsonResponse {
    $request->user()?->currentAccessToken()?->delete();

    return response()->json(['ok' => true]);
  }
}
