<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('message_attachments', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('message_id')->constrained('messages')->cascadeOnDelete();
      $table->foreignUuid('dialog_id')->constrained('dialogs')->cascadeOnDelete();
      $table->foreignUuid('uploader_id')->nullable()->constrained('users')->nullOnDelete();
      $table->string('type', 20);
      $table->string('mime_type', 120);
      $table->string('original_name', 255);
      $table->string('path', 255)->unique();
      $table->unsignedBigInteger('size');
      $table->unsignedInteger('width')->nullable();
      $table->unsignedInteger('height')->nullable();
      $table->unsignedInteger('duration')->nullable();
      $table->string('thumbnail_path', 255)->nullable();
      $table->unsignedSmallInteger('sort_order')->default(0);
      $table->timestamps();

      $table->index(['message_id', 'sort_order']);
      $table->index(['dialog_id', 'type', 'created_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('message_attachments');
  }
};
