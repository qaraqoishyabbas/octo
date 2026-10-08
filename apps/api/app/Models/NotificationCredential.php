<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class NotificationCredential extends Model {
  use HasUuids;

  protected $fillable = ['notification_app_id', 'provider', 'credentials'];
  protected $hidden = ['credentials'];

  protected function casts(): array {
    return ['credentials' => 'encrypted:array'];
  }
}
