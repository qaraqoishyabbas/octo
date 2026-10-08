<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('temporary_uploads', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
      $table->string('path', 255)->unique();
      $table->string('type', 20)->default('media');
      $table->string('mime_type', 120)->nullable();
      $table->string('original_name', 255)->nullable();
      $table->unsignedBigInteger('size')->default(0);
      $table->unsignedInteger('width')->nullable();
      $table->unsignedInteger('height')->nullable();
      $table->unsignedInteger('duration')->nullable();
      $table->string('thumbnail_path', 255)->nullable();
      $table->timestamps();

      $table->index(['user_id', 'created_at']);
      $table->index(['type', 'created_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('temporary_uploads');
  }
};
