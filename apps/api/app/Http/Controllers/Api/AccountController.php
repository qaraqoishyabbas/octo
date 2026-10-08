<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TemporaryUpload;
use App\Rules\TemporaryFileExists;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AccountController extends Controller {
  /**
   * Update the user's profile information.
   */
  public function update(Request $request): JsonResponse {
    $request->merge([
      'first_name' => $request->first_name ? Str::squish(Str::onlyWords($request->first_name)) : '',
      'last_name' => $request->last_name ? Str::squish(Str::onlyWords($request->last_name)) : '',
      'bio' => $request->bio ? $request->bio : '',
    ]);

    $user = $request->user();

    $request->validate([
      'first_name' => ['required', 'string', 'min:3', 'max:100'],
      'last_name' => ['required', 'string', 'min:3', 'max:100'],
      'bio' => ['string', 'min:3', 'max:100'],
      'email' => ['required', 'email', 'unique:users,email,' . $user->id],
      'avatar' => ['nullable', 'string', Rule::excludeIf($request->avatar === $user->avatar), 'regex:/^avatars\/[0-9a-f-]{36}\.[a-z]+$/i', new TemporaryFileExists],
    ]);

    if ($user->avatar && Str::startsWith($user->avatar, 'avatars/') && $user->avatar !== $request->avatar) {
      Storage::disk('public')->delete($user->avatar);
    }

    $email = $user->email;

    $user->update($request->only(['first_name', 'last_name', 'bio', 'email', 'avatar']));

    if ($email !== $request->email) {
      $user->email_verified_at = null;
      $user->save(['timestamps' => false]);
      $user->sendEmailVerificationNotification();
    }

    // Delete temporary upload record
    TemporaryUpload::where('path', $request->avatar)->delete();

    return response()->json(['ok' => true]);
  }

  /**
   * Update the user's username.
   */
  public function updateUsername(Request $request): JsonResponse {
    $user = $request->user();

    $request->merge([
      'username' => $request->username ? Str::lower(trim($request->username)) : '',
    ]);

    $validated = $request->validate([
      'username' => [
        'required',
        'string',
        'min:5',
        'max:30',
        'regex:/^[a-z0-9._-]+$/',
        Rule::unique('users', 'username')->ignore($user->id),
      ],
    ]);

    $user->username = $validated['username'];
    $user->save();

    return response()->json(['ok' => true]);
  }

  /**
   * Update the user's birth date.
   */
  public function updateBirthDate(Request $request): JsonResponse {
    $validated = $request->validate([
      'birth_date' => ['present', 'nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:1900-01-01'],
    ]);

    $user = $request->user();
    $user->birth_date = $validated['birth_date'];
    $user->save();

    return response()->json(['ok' => true]);
  }

  /**
   * Get authenticated user details
   */
  public function me(Request $request): JsonResponse {
    $user = $request->user();

    return response()->json([
      'ok' => true,
      'user' => [
        ...$user->toArray(),
        'has_password' => (bool)$user->password,
      ],
    ]);
  }
}
