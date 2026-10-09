<?php

namespace App\Providers;

use App\Contracts\GeoIpResolver;
use App\Helpers\Image;
use App\Models\PersonalAccessToken;
use App\Services\MaxMindGeoIpResolver;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider {
  /**
   * Register any application services.
   */
  public function register(): void {
    $this->app->singleton(GeoIpResolver::class, function ($app): GeoIpResolver {
      $path = (string)$app['config']->get('geoip.database_path');

      if (!str_starts_with($path, DIRECTORY_SEPARATOR) && !preg_match('/^[A-Za-z]:[\\\\\/]/', $path)) {
        $path = base_path($path);
      }

      return new MaxMindGeoIpResolver($path, $app['log']);
    });
  }

  /**
   * Bootstrap any application services.
   */
  public function boot(): void {
    if ($this->app->environment('production')) {
      \Illuminate\Support\Facades\URL::forceScheme('https');
    }
    Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

    RateLimiter::for('api', static function (Request $request) {
      return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
    });

    RateLimiter::for('uploads', static function (Request $request) {
      return Limit::perMinute(20)->by($request->user()?->id ?: $request->ip());
    });

    RateLimiter::for('login', static function (Request $request) {
      return Limit::perMinute(5)
        ->by(Str::transliterate(implode('|', [
          strtolower($request->input('username')),
          $request->ip()
        ])))
        ->response(static function (Request $request, array $headers): void {
          event(new Lockout($request));

          throw ValidationException::withMessages([
            'username' => trans('auth.throttle', [
              'seconds' => $headers['Retry-After'],
              'minutes' => ceil($headers['Retry-After'] / 60),
            ]),
          ]);
        });
    });

    /**
     * Convert uploaded image to webp, jpeg or png format and resize it
     */
    UploadedFile::macro('convert', function (?int $width = null, ?int $height = null, string $extension = 'webp', int $quality = 90) {
      return tap($this, static function (UploadedFile $file) use ($width, $height, $extension, $quality) {
        Image::convert($file->path(), $file->path(), $width, $height, $extension, $quality);
      });
    });

    /**
     * Remove all special characters from a string
     */
    Str::macro('onlyWords', static function (string $text): string {
      // \p{L} matches any kind of letter from any language
      // \d matches a digit in any script
      return Str::replaceMatches('/[^\p{L}\d ]/u', '', $text);
    });

  }
}
