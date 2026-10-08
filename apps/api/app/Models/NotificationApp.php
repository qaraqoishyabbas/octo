<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NotificationApp extends Model {
  use HasUuids;

  protected $fillable = ['owner_id', 'name', 'platform', 'enabled'];

  protected function casts(): array {
    return ['enabled' => 'boolean'];
  }

  public function credentials(): HasMany {
    return $this->hasMany(NotificationCredential::class);
  }

  public function pushTokens(): HasMany {
    return $this->hasMany(PushToken::class);
  }

  public function deliveries(): HasMany {
    return $this->hasMany(NotificationDelivery::class);
  }
}
