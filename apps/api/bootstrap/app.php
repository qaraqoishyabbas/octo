<?php

use App\Http\Middleware\JsonResponse;
use App\Http\Middleware\EnsureBearerToken;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetApplicationLocale;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\IpUtils;

return Application::configure(basePath: dirname(__DIR__))
  ->withRouting(
    web: __DIR__ . '/../routes/web.php',
    api: __DIR__ . '/../routes/api.php',
    commands: __DIR__ . '/../routes/console.php',
  )
  ->withBroadcasting(__DIR__ . '/../routes/channels.php', [
    'middleware' => [EnsureBearerToken::class, 'auth:sanctum'],
  ])
  ->withMiddleware(function (Middleware $middleware): void {
    $middleware
      ->trustProxies(at: IpUtils::PRIVATE_SUBNETS)
      ->api(prepend: [
        JsonResponse::class,
        SetApplicationLocale::class
      ])
      ->web(append: [
        HandleInertiaRequests::class,
      ]);
  })
  ->withExceptions(function (Exceptions $exceptions): void {
    /*
     * Format not found responses
     */
    $exceptions->render(static function (NotFoundHttpException $e, Request $request) {
      if ($request->is('api*')) {
        return response()->json([
          'ok' => false,
          'message' => $e->getMessage(),
        ], $e->getStatusCode(), [], JSON_UNESCAPED_SLASHES);
      }
    });

    /*
     * Format unauthorized responses
     */
    $exceptions->render(static function (AuthenticationException $e, Request $request): \Illuminate\Http\JsonResponse|\Illuminate\Http\RedirectResponse {
      if ($request->is('api*') || $request->is('broadcasting/auth')) {
        return response()->json([
          'ok' => false,
          'message' => __('Unauthenticated.'),
        ], 401, [], JSON_UNESCAPED_SLASHES);
      }

      return redirect()->guest(route('web.login'));
    });

    /*
     * Format validation errors
     */
    $exceptions->render(static function (ValidationException $e, Request $request): ?\Illuminate\Http\JsonResponse {
      if (!$request->is('api*')) {
        return null;
      }

      return response()->json([
        'ok' => false,
        'message' => $e->getMessage(),
        'errors' => array_map(static function (string $field, array $errors): array {
          return [
            'name' => $field,
            'message' => implode(' ', $errors),
          ];
        }, array_keys($e->errors()), $e->errors()),
      ], $e->status);
    });
  })->create();
