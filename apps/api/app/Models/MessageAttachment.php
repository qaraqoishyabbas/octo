<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageAttachment extends Model {
  use HasFactory, HasUuids;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $fillable = [
    'id',
    'message_id',
    'dialog_id',
    'uploader_id',
    'type',
    'mime_type',
    'original_name',
    'path',
    'size',
    'width',
    'height',
    'duration',
    'thumbnail_path',
    'sort_order',
  ];

  protected $casts = [
    'size' => 'integer',
    'width' => 'integer',
    'height' => 'integer',
    'duration' => 'integer',
    'sort_order' => 'integer',
  ];

  public function message(): BelongsTo {
    return $this->belongsTo(Message::class);
  }

  public function dialog(): BelongsTo {
    return $this->belongsTo(Dialog::class);
  }

  public function uploader(): BelongsTo {
    return $this->belongsTo(User::class, 'uploader_id');
  }
}
