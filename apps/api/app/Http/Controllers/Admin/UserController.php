<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller {
  public function index(Request $request): Response {
    $search = trim((string)$request->query('search', ''));

    $users = User::query()
      ->withCount(['dialogs', 'authoredDialogs'])
      ->withLastSeenAt()
      ->when($search !== '', fn($query) => $query->where(function ($query) use ($search) {
        $query
          ->where('first_name', 'like', "%{$search}%")
          ->orWhere('last_name', 'like', "%{$search}%")
          ->orWhere('email', 'like', "%{$search}%")
          ->orWhere('username', 'like', "%{$search}%");
      }))
      ->latest()
      ->paginate(12)
      ->withQueryString()
      ->through(fn(User $user) => [
        'id' => $user->id,
        'first_name' => $user->first_name,
        'last_name' => $user->last_name,
        'name' => trim($user->first_name . ' ' . $user->last_name) ?: $user->username,
        'email' => $user->email,
        'username' => $user->username,
        'bio' => $user->bio,
        'birth_date' => $user->birth_date?->format('Y-m-d'),
        'dialogs_count' => $user->dialogs_count,
        'authored_dialogs_count' => $user->authored_dialogs_count,
        'last_seen_at' => $user->last_seen_at,
        'created_at' => $user->created_at?->format('Y-m-d H:i'),
      ]);

    return Inertia::render('Users/Index', [
      'users' => $users,
      'filters' => [
        'search' => $search,
      ],
    ]);
  }

  public function store(Request $request): RedirectResponse {
    User::query()->create($this->validated($request));

    return back()->with('success', 'User created.');
  }

  public function update(Request $request, User $user): RedirectResponse {
    $user->update($this->validated($request, $user));

    return back()->with('success', 'User updated.');
  }

  public function destroy(User $user): RedirectResponse {
    if ((string)$user->id === (string)auth()->id()) {
      return back()->withErrors([
        'user' => 'You cannot delete your own account.',
      ]);
    }

    $user->delete();

    return back()->with('success', 'User deleted.');
  }

  private function validated(Request $request, ?User $user = null): array {
    $rules = [
      'first_name' => ['nullable', 'string', 'max:255'],
      'last_name' => ['nullable', 'string', 'max:255'],
      'bio' => ['nullable', 'string', 'max:1000'],
      'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user?->id)],
      'username' => ['required', 'string', 'max:255', Rule::unique('users', 'username')->ignore($user?->id)],
      'birth_date' => ['nullable', 'date'],
      'password' => [$user ? 'nullable' : 'required', 'string', 'min:8'],
    ];

    $validated = $request->validate($rules);

    if (($validated['password'] ?? '') === '') {
      unset($validated['password']);
    }

    return $validated;
  }
}
