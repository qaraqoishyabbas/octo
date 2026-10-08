<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Device extends Model {
  use HasUuids;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $guarded = [];

  protected function casts(): array {
    return [
      'is_bot' => 'boolean',
      'device_data' => 'array',
      'geo_data' => 'array',
      'latitude' => 'float',
      'longitude' => 'float',
    ];
  }

  public function user(): BelongsTo {
    return $this->belongsTo(User::class);
  }

  public function token(): BelongsTo {
    return $this->belongsTo(PersonalAccessToken::class, 'personal_access_token_id');
  }
}
