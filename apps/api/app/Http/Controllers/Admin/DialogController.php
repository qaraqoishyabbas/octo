<?php

namespace App\Http\Controllers\Admin;

use App\Enums\DialogMemberRole;
use App\Enums\DialogType;
use App\Http\Controllers\Controller;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DialogController extends Controller {
  public function channels(Request $request): Response {
    return $this->index($request, DialogType::CHANNEL);
  }

  public function groups(Request $request): Response {
    return $this->index($request, DialogType::GROUP);
  }

  public function store(Request $request, string $type): RedirectResponse {
    $dialogType = $this->dialogType($type);
    $validated = $this->validateDialog($request);

    DB::transaction(function () use ($dialogType, $validated): void {
      $ownerId = $validated['owner_id'] ?? null;

      $dialog = Dialog::query()->create([
        'type' => $dialogType->value,
        'title' => $validated['title'],
        'description' => $validated['description'] ?? null,
        'author_id' => $ownerId,
      ]);

      if ($ownerId) {
        $dialog->users()->attach($ownerId, [
          'role' => DialogMemberRole::OWNER->value,
        ]);
      }
    });

    return back()->with('success', ucfirst($this->label($dialogType)) . ' created.');
  }

  public function update(Request $request, Dialog $dialog): RedirectResponse {
    $validated = $this->validateDialog($request, ownerRequired: false);

    $dialog->update([
      'title' => $validated['title'],
      'description' => $validated['description'] ?? null,
    ]);

    return back()->with('success', ucfirst($this->label($dialog->type)) . ' updated.');
  }

  public function destroy(Dialog $dialog): RedirectResponse {
    $dialog->delete();

    return redirect()
      ->route($this->routeName($dialog->type))
      ->with('success', ucfirst($this->label($dialog->type)) . ' deleted.');
  }

  public function setOwner(Request $request, Dialog $dialog): RedirectResponse {
    $validated = $request->validate([
      'owner_id' => ['required', 'uuid', 'exists:users,id'],
    ]);

    DB::transaction(function () use ($dialog, $validated): void {
      $dialog->update([
        'author_id' => $validated['owner_id'],
      ]);

      DB::table('dialog_user')
        ->where('dialog_id', $dialog->id)
        ->where('role', DialogMemberRole::OWNER->value)
        ->update(['role' => DialogMemberRole::ADMIN->value]);

      $dialog->users()->syncWithoutDetaching([
        $validated['owner_id'] => [
          'role' => DialogMemberRole::OWNER->value,
        ],
      ]);

      $dialog->users()->updateExistingPivot($validated['owner_id'], [
        'role' => DialogMemberRole::OWNER->value,
      ]);
    });

    return back()->with('success', 'Owner changed.');
  }

  public function storeMember(Request $request, Dialog $dialog): RedirectResponse {
    $validated = $request->validate([
      'user_id' => ['required', 'uuid', 'exists:users,id'],
      'role' => ['required', Rule::in(DialogMemberRole::values())],
    ]);

    if ($validated['role'] === DialogMemberRole::OWNER->value) {
      throw ValidationException::withMessages([
        'role' => 'Use the owner tool to transfer ownership.',
      ]);
    }

    $dialog->users()->syncWithoutDetaching([
      $validated['user_id'] => [
        'role' => $validated['role'],
      ],
    ]);

    return back()->with('success', 'Member added.');
  }

  public function updateMember(Request $request, Dialog $dialog, User $user): RedirectResponse {
    $validated = $request->validate([
      'role' => ['required', Rule::in(DialogMemberRole::values())],
      'muted' => ['required', 'boolean'],
      'pinned' => ['required', 'boolean'],
    ]);

    if ($validated['role'] !== DialogMemberRole::OWNER->value && (string)$dialog->author_id === (string)$user->id) {
      return back()->withErrors([
        'member' => 'Change the dialog owner before demoting this user.',
      ]);
    }

    if ($validated['role'] === DialogMemberRole::OWNER->value && (string)$dialog->author_id !== (string)$user->id) {
      throw ValidationException::withMessages([
        'role' => 'Use the owner tool to transfer ownership.',
      ]);
    }

    $dialog->users()->updateExistingPivot($user->id, $validated);

    return back()->with('success', 'Member updated.');
  }

  public function destroyMember(Dialog $dialog, User $user): RedirectResponse {
    if ((string)$dialog->author_id === (string)$user->id) {
      return back()->withErrors([
        'member' => 'Change the dialog owner before removing this user.',
      ]);
    }

    $dialog->users()->detach($user->id);

    return back()->with('success', 'Member removed.');
  }

  private function index(Request $request, DialogType $type): Response {
    $search = trim((string)$request->query('search', ''));
    $selectedId = $request->query('dialog');

    $dialogs = Dialog::query()
      ->with(['author:id,first_name,last_name,username,email'])
      ->withCount(['users', 'messages'])
      ->where('type', $type->value)
      ->when($search !== '', fn($query) => $query->where(function ($query) use ($search) {
        $query
          ->where('title', 'like', "%{$search}%")
          ->orWhere('description', 'like', "%{$search}%");
      }))
      ->latest()
      ->paginate(10)
      ->withQueryString();

    $selectedDialog = $selectedId
      ? Dialog::query()->where('type', $type->value)->whereKey($selectedId)->first()
      : Dialog::query()->where('type', $type->value)->latest()->first();

    $selectedDialog?->load([
      'author:id,first_name,last_name,username,email',
      'users' => fn($query) => $query
        ->select('users.id', 'first_name', 'last_name', 'username', 'email')
        ->orderByRaw("CASE dialog_user.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END")
        ->orderBy('first_name'),
    ]);
    $selectedDialog?->loadCount(['users', 'messages']);

    return Inertia::render('Dialogs/Index', [
      'kind' => [
        'type' => $type->value,
        'label' => ucfirst($this->label($type)),
        'plural' => ucfirst($this->label($type, plural: true)),
        'route' => $this->routeName($type),
        'storeUrl' => route('web.dialogs.store', ['type' => $type->value]),
      ],
      'dialogs' => $dialogs->through(fn(Dialog $dialog) => $this->dialogSummary($dialog)),
      'selectedDialog' => $selectedDialog ? $this->dialogDetail($selectedDialog) : null,
      'users' => User::query()
        ->orderBy('first_name')
        ->orderBy('last_name')
        ->get(['id', 'first_name', 'last_name', 'username', 'email'])
        ->map(fn(User $user) => $this->userOption($user)),
      'roles' => DialogMemberRole::values(),
      'filters' => [
        'search' => $search,
      ],
    ]);
  }

  private function validateDialog(Request $request, bool $ownerRequired = true): array {
    return $request->validate([
      'title' => ['required', 'string', 'max:255'],
      'description' => ['nullable', 'string', 'max:2000'],
      'owner_id' => [$ownerRequired ? 'nullable' : 'sometimes', 'nullable', 'uuid', 'exists:users,id'],
    ]);
  }

  private function dialogType(string $type): DialogType {
    return DialogType::from($type);
  }

  private function routeName(DialogType $type): string {
    return match ($type) {
      DialogType::CHANNEL => 'web.channels.index',
      DialogType::GROUP => 'web.groups.index',
      default => 'dashboard',
    };
  }

  private function label(DialogType $type, bool $plural = false): string {
    return match ($type) {
      DialogType::CHANNEL => $plural ? 'channels' : 'channel',
      DialogType::GROUP => $plural ? 'groups' : 'group',
      default => $plural ? 'dialogs' : 'dialog',
    };
  }

  private function dialogSummary(Dialog $dialog): array {
    return [
      'id' => $dialog->id,
      'dialog_id' => $dialog->dialog_id,
      'title' => $dialog->title ?: $dialog->dialog_id,
      'description' => $dialog->description,
      'owner' => $dialog->author ? $this->userOption($dialog->author) : null,
      'users_count' => $dialog->users_count,
      'messages_count' => $dialog->messages_count,
      'created_at' => $dialog->created_at?->format('Y-m-d H:i'),
    ];
  }

  private function dialogDetail(Dialog $dialog): array {
    return [
      ...$this->dialogSummary($dialog),
      'owner_id' => $dialog->author_id,
      'members' => $dialog->users->map(fn(User $user) => [
        ...$this->userOption($user),
        'role' => $user->pivot?->role,
        'muted' => (bool)$user->pivot?->muted,
        'pinned' => (bool)$user->pivot?->pinned,
        'joined_at' => $user->pivot?->created_at?->format('Y-m-d H:i'),
      ])->values(),
    ];
  }

  private function userOption(User $user): array {
    return [
      'id' => $user->id,
      'name' => trim($user->first_name . ' ' . $user->last_name) ?: $user->username,
      'email' => $user->email,
      'username' => $user->username,
    ];
  }
}
