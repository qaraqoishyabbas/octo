<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller {
  public function create(): Response {
    return Inertia::render('Auth/Login');
  }

  public function store(Request $request): RedirectResponse {
    $credentials = $request->validate([
      'username' => ['required_without:email', 'nullable', 'string'],
      'email' => ['required_without:username', 'nullable', 'email'],
      'password' => ['required', 'string'],
      'remember' => ['nullable', 'boolean'],
    ]);

    $remember = (bool)($credentials['remember'] ?? false);
    $identityField = $request->filled('username') ? 'username' : 'email';
    $credentials = [
      $identityField => $credentials[$identityField],
      'password' => $credentials['password'],
    ];

    if (!Auth::attempt($credentials, $remember)) {
      throw ValidationException::withMessages([
        $identityField => __('These credentials do not match our records.'),
      ]);
    }

    $request->session()->regenerate();

    return redirect()->intended(route('dashboard'));
  }

  public function destroy(Request $request): RedirectResponse {
    Auth::guard('web')->logout();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect()->route('web.login');
  }
}
