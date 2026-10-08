<?php

namespace App\Support;

use App\Enums\DialogMemberRole;
use App\Enums\DialogPermission;
use App\Enums\DialogType;
use App\Models\Dialog;

class DialogAccess {
  public static function allows(?Dialog $dialog, DialogPermission $permission): bool {
    if (!$dialog) {
      return false;
    }

    return in_array($permission->value, self::permissions($dialog), true);
  }

  /**
   * @return list<string>
   */
  public static function permissions(Dialog $dialog): array {
    return self::permissionsFor(
      $dialog->pivot?->role,
      $dialog->type,
      $dialog->pivot?->permissions,
    );
  }

  /**
   * @return list<string>
   */
  public static function permissionsFor(?string $role, ?DialogType $type, mixed $permissions = null): array {
    if ($role === DialogMemberRole::OWNER->value) {
      return DialogPermission::ownerDefaults();
    }

    if ($role === DialogMemberRole::ADMIN->value) {
      $customPermissions = self::customPermissions($permissions);

      return self::mergePermissions(
        self::basePermissions($type),
        $customPermissions ?? DialogPermission::adminDefaults(),
      );
    }

    return self::basePermissions($type);
  }

  /**
   * @return list<string>
   */
  private static function basePermissions(?DialogType $type): array {
    if ($type === DialogType::DIRECT) {
      return [
        DialogPermission::SEND_MESSAGES->value,
        DialogPermission::PIN_MESSAGES->value,
      ];
    }

    if ($type === DialogType::GROUP) {
      return [DialogPermission::SEND_MESSAGES->value];
    }

    return [];
  }

  /**
   * @param list<string> ...$permissionGroups
   * @return list<string>
   */
  private static function mergePermissions(array ...$permissionGroups): array {
    return collect($permissionGroups)
      ->flatten()
      ->unique()
      ->values()
      ->all();
  }

  /**
   * @return list<string>|null
   */
  private static function customPermissions(mixed $permissions): ?array {
    if ($permissions === null) {
      return null;
    }

    if (is_string($permissions)) {
      $decoded = json_decode($permissions, true);
      $permissions = is_array($decoded) ? $decoded : [];
    }

    if (!is_array($permissions)) {
      return [];
    }

    return collect($permissions)
      ->filter(fn($permission) => is_string($permission) && in_array($permission, DialogPermission::values(), true))
      ->unique()
      ->values()
      ->all();
  }
}
