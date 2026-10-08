<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationPreference extends Model {
  public $incrementing = false;
  protected $primaryKey = 'user_id';
  protected $keyType = 'string';
  protected $fillable = ['user_id', 'enabled', 'sound', 'badge', 'mentions_in_muted', 'show_text', 'show_names'];
  protected $attributes = [
    'enabled' => true,
    'sound' => true,
    'badge' => true,
    'mentions_in_muted' => true,
    'show_text' => true,
    'show_names' => true,
  ];

  protected function casts(): array {
    return [
      'enabled' => 'boolean', 'sound' => 'boolean', 'badge' => 'boolean', 'mentions_in_muted' => 'boolean',
      'show_text' => 'boolean', 'show_names' => 'boolean',
    ];
  }
}
