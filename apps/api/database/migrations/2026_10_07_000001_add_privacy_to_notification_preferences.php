<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::table('notification_preferences', function (Blueprint $table) {
      $table->boolean('show_text')->default(true);
      $table->boolean('show_names')->default(true);
    });
  }

  public function down(): void {
    Schema::table('notification_preferences', function (Blueprint $table) {
      $table->dropColumn(['show_text', 'show_names']);
    });
  }
};
