<?php

namespace App\Models;

use App\Enums\DialogType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Dialog extends Model {
  use HasFactory, HasUuids;

  public $incrementing = false;

  protected $keyType = 'string';

  protected $fillable = [
    'author_id',
    'title',
    'description',
    'avatar',
    'invite_token',
    'type',
  ];

  protected $appends = [
    'dialog_id',
  ];

  protected function casts(): array {
    return [
      'type' => DialogType::class,
    ];
  }

  public static function columns(): array {
    return [
      'dialogs.id',
      'dialogs.author_id',
      'dialogs.title',
      'dialogs.description',
      'dialogs.avatar',
      'dialogs.invite_token',
      'dialogs.type',
      'dialogs.created_at',
    ];
  }

  public static function parseDialogId(string $dialogId): ?array {
    $parts = explode('-', $dialogId, 2);

    if (count($parts) !== 2 || !in_array($parts[0], DialogType::values(), true)) {
      return null;
    }

    return [
      'type' => $parts[0],
      'id' => $parts[1],
    ];
  }

  public function scopeWherePublicDialogId(Builder $query, string $dialogId): Builder {
    $parts = self::parseDialogId($dialogId);

    if (!$parts) {
      return $query->whereRaw('1 = 0');
    }

    return $query
      ->where('dialogs.type', $parts['type'])
      ->where('dialogs.id', $parts['id']);
  }

  public function scopeWithLastMessage(Builder $query): Builder {
    return $query->with([
      'message' => fn($q) => $q
        ->select('messages.id', 'messages.dialog_id', 'messages.sender_id', 'messages.message', 'messages.created_at', 'messages.updated_at'),
      'message.attachments',
      'message.sender',
    ]);
  }

  public function scopeOrderedByActivity(Builder $query): Builder {
    return $query
      ->orderByDesc('dialog_user.pinned')
      ->orderByRaw('(SELECT MAX(messages.created_at) FROM messages WHERE messages.dialog_id = dialogs.id AND messages.deleted_at IS NULL) DESC')
      ->orderByDesc('dialogs.id');
  }

  protected function dialogId(): Attribute {
    return Attribute::make(
      get: fn() => $this->type->value . '-' . $this->id,
    );
  }

  public function users(): BelongsToMany {
    return $this->belongsToMany(User::class, 'dialog_user', 'dialog_id', 'user_id')
      ->withPivot(['role', 'permissions', 'muted', 'pinned', 'archived'])
      ->withTimestamps();
  }

  public function author(): BelongsTo {
    return $this->belongsTo(User::class, 'author_id');
  }

  public function messages(): HasMany {
    return $this->hasMany(Message::class, 'dialog_id');
  }

  public function message(): HasOne {
    return $this->hasOne(Message::class, 'dialog_id')->latestOfMany('created_at');
  }
}
