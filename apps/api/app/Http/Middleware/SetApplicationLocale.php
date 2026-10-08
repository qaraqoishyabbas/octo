<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SetApplicationLocale {
  public function handle(Request $request, Closure $next) {
    $availableLocales = ['kk', 'ru', 'en'];
    $locale = $request->getPreferredLanguage($availableLocales);
    app()->setLocale($locale ?? config('app.locale'));
    return $next($request);
  }
}
