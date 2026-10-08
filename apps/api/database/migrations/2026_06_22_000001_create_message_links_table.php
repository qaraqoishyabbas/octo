<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('message_links', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('message_id')->constrained('messages')->cascadeOnDelete();
      $table->foreignUuid('dialog_id')->constrained('dialogs')->cascadeOnDelete();
      $table->foreignUuid('sender_id')->nullable()->constrained('users')->nullOnDelete();
      $table->string('url', 2048);
      $table->string('title', 500)->nullable();
      $table->unsignedSmallInteger('sort_order')->default(0);
      $table->timestamps();

      $table->index(['message_id', 'sort_order']);
      $table->index(['dialog_id', 'created_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('message_links');
  }
};
