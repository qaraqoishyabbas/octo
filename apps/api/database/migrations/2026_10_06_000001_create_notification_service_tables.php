<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('notification_apps', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('owner_id')->constrained('users')->cascadeOnDelete();
      $table->string('name', 100);
      $table->string('platform', 24);
      $table->boolean('enabled')->default(true);
      $table->timestamps();
      $table->index(['owner_id', 'platform']);
    });

    Schema::create('notification_credentials', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('notification_app_id')->constrained('notification_apps')->cascadeOnDelete();
      $table->string('provider', 24);
      $table->text('credentials');
      $table->timestamps();
      $table->unique(['notification_app_id', 'provider']);
    });

    Schema::create('push_tokens', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('notification_app_id')->constrained('notification_apps')->cascadeOnDelete();
      $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
      $table->foreignUuid('personal_access_token_id')->nullable()->constrained('personal_access_tokens')->cascadeOnDelete();
      $table->string('provider', 24);
      $table->string('token_hash', 64);
      $table->text('token');
      $table->json('metadata')->nullable();
      $table->timestamp('last_seen_at')->nullable();
      $table->timestamps();
      $table->unique(['notification_app_id', 'token_hash']);
      $table->index(['user_id', 'notification_app_id']);
    });

    Schema::create('notification_deliveries', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('notification_app_id')->constrained('notification_apps')->cascadeOnDelete();
      $table->foreignUuid('push_token_id')->nullable()->constrained('push_tokens')->nullOnDelete();
      $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
      $table->string('status', 24)->default('queued');
      $table->string('title', 200);
      $table->text('body');
      $table->json('data')->nullable();
      $table->string('error_code', 100)->nullable();
      $table->timestamp('sent_at')->nullable();
      $table->timestamps();
      $table->index(['notification_app_id', 'created_at']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('notification_deliveries');
    Schema::dropIfExists('push_tokens');
    Schema::dropIfExists('notification_credentials');
    Schema::dropIfExists('notification_apps');
  }
};
