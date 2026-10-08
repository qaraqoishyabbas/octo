<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware {
  /**
   * The root template that's loaded on the first page visit.
   *
   * @var string
   */
  protected $rootView = 'app';

  /**
   * Determines the current asset version.
   */
  public function version(Request $request): ?string {
    return parent::version($request);
  }

  /**
   * Define the props that are shared by default.
   *
   * @return array<string, mixed>
   */
  public function share(Request $request): array {
    return [
      ...parent::share($request),
      'app' => [
        'name' => config('app.name'),
      ],
      'auth' => [
        'user' => $request->user() ? [
          'id' => $request->user()->id,
          'name' => trim($request->user()->first_name . ' ' . $request->user()->last_name) ?: $request->user()->username,
          'email' => $request->user()->email,
          'username' => $request->user()->username,
        ] : null,
      ],
      'flash' => [
        'success' => fn() => $request->session()->get('success'),
      ],
    ];
  }
}
