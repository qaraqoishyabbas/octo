<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageLink extends Model {
  use HasFactory, HasUuids;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $fillable = [
    'message_id',
    'dialog_id',
    'sender_id',
    'url',
    'title',
    'sort_order',
  ];

  protected $casts = [
    'sort_order' => 'integer',
  ];

  public function message(): BelongsTo {
    return $this->belongsTo(Message::class);
  }

  public function dialog(): BelongsTo {
    return $this->belongsTo(Dialog::class);
  }

  public function sender(): BelongsTo {
    return $this->belongsTo(User::class, 'sender_id');
  }
}
