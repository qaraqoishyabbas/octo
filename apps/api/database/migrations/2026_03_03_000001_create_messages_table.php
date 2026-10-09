<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('messages', function (Blueprint $table) {
      $table->uuid('id');
      // Register the primary key before the self-reference for PostgreSQL.
      $table->primary('id');
      $table->foreignUuid('dialog_id')->constrained('dialogs')->cascadeOnDelete();
      $table->foreignUuid('sender_id')->nullable()->constrained('users')->cascadeOnDelete();
      $table->foreignUuid('reply_to_id')
        ->nullable()
        ->after('sender_id')
        ->constrained('messages')
        ->nullOnDelete();
      $table->foreignUuid('pinned_by_id')
        ->nullable()
        ->after('pinned_at')
        ->constrained('users')
        ->nullOnDelete();
      $table->text('message');
      $table->timestamp('pinned_at')->nullable();
      $table->softDeletes();
      $table->timestamps();
      $table->index(['dialog_id', 'created_at', 'id']);
      $table->index(['dialog_id', 'sender_id', 'created_at']);
      $table->index(['dialog_id', 'deleted_at', 'created_at']);
      $table->index(['dialog_id', 'pinned_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('messages');
  }
};
