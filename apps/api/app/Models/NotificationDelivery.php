<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationDelivery extends Model {
  use HasUuids;

  protected $fillable = ['notification_app_id', 'push_token_id', 'user_id', 'status', 'title', 'body', 'data', 'error_code', 'sent_at'];

  protected function casts(): array {
    return ['data' => 'array', 'sent_at' => 'datetime'];
  }

  public function app(): BelongsTo {
    return $this->belongsTo(NotificationApp::class, 'notification_app_id');
  }

  public function pushToken(): BelongsTo {
    return $this->belongsTo(PushToken::class);
  }
}
