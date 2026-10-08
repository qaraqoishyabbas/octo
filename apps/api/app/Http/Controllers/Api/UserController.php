<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller {
  public function index(Request $request): JsonResponse {
    $me = $request->user();

    $perPage = (int)$request->query('per_page', 50);
    if ($perPage < 1) {
      $perPage = 50;
    }
    if ($perPage > 100) {
      $perPage = 100;
    }

    $page = (int)$request->query('page', 1);
    if ($page < 1) {
      $page = 1;
    }

    $q = trim((string)$request->query('q', ''));
    $sortBy = (string)$request->query('sort_by', 'last_seen');

    $query = User::query()
      ->withLastSeenAt()
      ->where('id', '!=', $me->id);

    if ($q !== '') {
      $parts = array_filter(explode(' ', $q));

      $query->where(function ($sub) use ($parts) {
        foreach ($parts as $part) {
          $sub->where(function ($inner) use ($part) {
            $inner->where('first_name', 'like', "%{$part}%")
              ->orWhere('last_name', 'like', "%{$part}%")
              ->orWhere('email', 'like', "%{$part}%");
          });
        }
      });
    }

    $total = (clone $query)->count();

    if ($sortBy === 'name') {
      $query
        ->orderBy('first_name')
        ->orderBy('last_name')
        ->orderBy('id');
    } else {
      $query
        ->orderByDesc('tokens_max_last_used_at')
        ->orderByDesc('id');
    }

    $items = $query->forPage($page, $perPage)->get()->values();

    return response()->json([
      'ok' => true,
      'users' => $items,
      'has_more' => ($page * $perPage) < $total,
      'total' => $total,
    ]);
  }
}
