<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TemporaryUpload extends Model {
  use HasFactory, HasUuids;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $fillable = [
    'user_id',
    'path',
    'type',
    'mime_type',
    'original_name',
    'size',
    'width',
    'height',
    'duration',
    'thumbnail_path',
  ];

  protected $casts = [
    'size' => 'integer',
    'width' => 'integer',
    'height' => 'integer',
    'duration' => 'integer',
  ];
}
