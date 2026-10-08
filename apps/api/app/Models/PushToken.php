<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushToken extends Model {
  use HasUuids;

  protected $fillable = ['notification_app_id', 'user_id', 'personal_access_token_id', 'provider', 'token_hash', 'token', 'metadata', 'last_seen_at'];
  protected $hidden = ['token', 'token_hash'];

  protected function casts(): array {
    return ['token' => 'encrypted', 'metadata' => 'array', 'last_seen_at' => 'datetime'];
  }

  public function app(): BelongsTo {
    return $this->belongsTo(NotificationApp::class, 'notification_app_id');
  }

  public function sessionToken(): BelongsTo {
    return $this->belongsTo(PersonalAccessToken::class, 'personal_access_token_id');
  }

  public function user(): BelongsTo {
    return $this->belongsTo(User::class);
  }
}
