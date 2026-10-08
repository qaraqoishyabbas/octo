<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('notification_preferences', function (Blueprint $table) {
      $table->foreignUuid('user_id')->primary()->constrained('users')->cascadeOnDelete();
      $table->boolean('enabled')->default(true);
      $table->boolean('sound')->default(true);
      $table->boolean('badge')->default(true);
      $table->boolean('mentions_in_muted')->default(true);
      $table->timestamps();
    });
  }

  public function down(): void {
    Schema::dropIfExists('notification_preferences');
  }
};
