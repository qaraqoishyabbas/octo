<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable {
  use HasApiTokens, HasFactory, HasUuids, Notifiable;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $fillable = [
    'first_name',
    'last_name',
    'bio',
    'email',
    'username',
    'password',
    'avatar',
    'birth_date',
  ];

  protected $hidden = [
    'password',
    'remember_token',
  ];

  protected $appends = [
    'name',
    'dialog_id',
    'last_seen_at',
  ];

  protected function casts(): array {
    return [
      'password' => 'hashed',
      'birth_date' => 'date:Y-m-d',
    ];
  }

  protected function name(): Attribute {
    return Attribute::make(
      get: fn() => "{$this->first_name} {$this->last_name}",
    );
  }

  protected function dialogId(): Attribute {
    return Attribute::make(
      get: fn() => 'D-' . $this->id,
    );
  }

  public function getLastSeenAtAttribute(): ?string {
    $lastSeenAt = $this->getAttribute('tokens_max_last_used_at');

    if (!$lastSeenAt) {
      $lastSeenAt = $this->tokens()
        ->selectRaw('MAX(last_used_at) as last_seen_at')
        ->value('last_seen_at');
    }

    if (!$lastSeenAt) {
      return null;
    }

    $lastSeenAt = $lastSeenAt instanceof Carbon
      ? $lastSeenAt
      : Carbon::parse($lastSeenAt);

    return $lastSeenAt->toISOString();
  }

  public function scopeWithLastSeenAt(Builder $query): Builder {
    return $query->withMax('tokens', 'last_used_at');
  }

  public function sessions(): HasMany {
    return $this->hasMany(Session::class);
  }

  public function devices(): HasMany {
    return $this->hasMany(Device::class);
  }

  public function notificationPreference(): HasOne {
    return $this->hasOne(NotificationPreference::class);
  }

  public function dialogs(): BelongsToMany {
    return $this->belongsToMany(Dialog::class, 'dialog_user', 'user_id', 'dialog_id')
      ->withPivot(['role', 'permissions', 'muted', 'pinned'])
      ->withTimestamps();
  }


  public function authoredDialogs(): HasMany {
    return $this->hasMany(Dialog::class, 'author_id');
  }
}
