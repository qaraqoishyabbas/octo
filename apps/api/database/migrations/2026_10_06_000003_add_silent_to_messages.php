<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::table('messages', function (Blueprint $table) {
      $table->boolean('silent')->default(false);
    });
  }

  public function down(): void {
    Schema::table('messages', function (Blueprint $table) {
      $table->dropColumn('silent');
    });
  }
};
