<?php

use App\Enums\DialogType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('dialogs', function (Blueprint $table) {
      $table->uuid('id')->primary();

      $table->foreignUuid('author_id')->nullable()->constrained('users')->nullOnDelete();
      $table->enum('type', DialogType::values())->default(DialogType::DIRECT->value)->index();
      $table->string('title')->nullable();
      $table->text('description')->nullable();
      $table->string('avatar')->nullable();
      $table->string('invite_token', 64)->nullable()->unique();

      $table->timestamps();
    });
  }

  public function down(): void {
    Schema::dropIfExists('dialogs');
  }
};
