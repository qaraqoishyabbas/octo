<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model {
  use HasFactory, HasUuids, SoftDeletes;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $fillable = [
    'dialog_id',
    'sender_id',
    'reply_to_id',
    'message',
    'silent',
    'pinned_at',
    'pinned_by_id',
  ];

  protected $casts = [
    'pinned_at' => 'datetime',
    'silent' => 'boolean',
  ];

  protected $appends = [
    'is_sender',
    'is_edited',
    'is_pinned',
  ];

  protected function isSender(): Attribute {
    return Attribute::make(
      get: fn() => $this->sender_id !== null && (string)$this->sender_id === (string)auth()->id(),
    );
  }

  protected function isEdited(): Attribute {
    return Attribute::make(
      get: fn() => $this->created_at && $this->updated_at && $this->updated_at->greaterThan($this->created_at),
    );
  }

  protected function isPinned(): Attribute {
    return Attribute::make(
      get: fn() => $this->pinned_at !== null,
    );
  }

  public function sender(): BelongsTo {
    return $this->belongsTo(User::class, 'sender_id');
  }

  public function dialog(): BelongsTo {
    return $this->belongsTo(Dialog::class, 'dialog_id');
  }

  public function replyTo(): BelongsTo {
    return $this->belongsTo(Message::class, 'reply_to_id');
  }

  public function pinnedBy(): BelongsTo {
    return $this->belongsTo(User::class, 'pinned_by_id');
  }

  public function attachments(): HasMany {
    return $this->hasMany(MessageAttachment::class)->orderBy('sort_order');
  }

  public function links(): HasMany {
    return $this->hasMany(MessageLink::class)->orderBy('sort_order');
  }
}
