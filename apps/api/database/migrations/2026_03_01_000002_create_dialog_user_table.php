<?php

use App\Enums\DialogMemberRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('dialog_user', function (Blueprint $table) {
      $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
      $table->foreignUuid('dialog_id')->constrained('dialogs')->cascadeOnDelete();

      $table->string('role', 16)->default(DialogMemberRole::MEMBER->value);


      $table->json('permissions')->nullable();
      $table->boolean('muted')->default(false);
      $table->boolean('pinned')->default(false);
      $table->boolean('archived')->default(false);
      $table->timestamp('last_read_at')->nullable();
      $table->timestamps();

      $table->primary(['user_id', 'dialog_id']);
      $table->index(['user_id', 'archived']);
      $table->index(['dialog_id', 'role']);
      $table->index(['user_id', 'last_read_at']);
      $table->index(['user_id']);
      $table->index(['user_id', 'pinned']);
      $table->index(['user_id', 'muted']);
    });
  }

  public function down(): void {
    Schema::dropIfExists('dialog_user');
  }
};
