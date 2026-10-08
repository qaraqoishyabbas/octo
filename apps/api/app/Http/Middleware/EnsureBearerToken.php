<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureBearerToken {
  /**
   * @throws AuthenticationException
   */
  public function handle(Request $request, Closure $next): Response {
    if (!$request->bearerToken()) {
      throw new AuthenticationException();
    }

    return $next($request);
  }
}
