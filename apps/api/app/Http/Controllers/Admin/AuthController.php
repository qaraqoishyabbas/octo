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
      'email' => ['required', 'email'],
      'password' => ['required', 'string'],
      'remember' => ['nullable', 'boolean'],
    ]);

    $remember = (bool)($credentials['remember'] ?? false);
    unset($credentials['remember']);

    if (!Auth::attempt($credentials, $remember)) {
      throw ValidationException::withMessages([
        'email' => __('These credentials do not match our records.'),
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
