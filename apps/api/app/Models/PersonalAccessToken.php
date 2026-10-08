<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken {
  use HasUuids;

  public $incrementing = false;

  protected $keyType = 'string';

  public function device(): HasOne {
    return $this->hasOne(Device::class);
  }
}
