<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
  public function up(): void {
    Schema::create('devices', function (Blueprint $table) {
      $table->uuid('id')->primary();
      $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
      $table->foreignUuid('personal_access_token_id')->unique()->constrained()->cascadeOnDelete();
      $table->string('ip', 45)->nullable();
      $table->text('user_agent')->nullable();
      $table->string('device_type')->nullable();
      $table->string('device_brand')->nullable();
      $table->string('device_model')->nullable();
      $table->string('os_name')->nullable();
      $table->string('os_version')->nullable();
      $table->string('os_platform')->nullable();
      $table->string('client_type')->nullable();
      $table->string('client_name')->nullable();
      $table->string('client_version')->nullable();
      $table->string('client_engine')->nullable();
      $table->string('client_engine_version')->nullable();
      $table->boolean('is_bot')->default(false);
      $table->json('device_data')->nullable();
      $table->string('country_code', 2)->nullable();
      $table->string('country_name')->nullable();
      $table->string('region_code')->nullable();
      $table->string('region_name')->nullable();
      $table->string('city')->nullable();
      $table->string('postal_code')->nullable();
      $table->string('timezone')->nullable();
      $table->decimal('latitude', 10, 7)->nullable();
      $table->decimal('longitude', 11, 7)->nullable();
      $table->unsignedInteger('accuracy_radius')->nullable();
      $table->json('geo_data')->nullable();
      $table->timestamps();

      $table->index(['user_id', 'created_at']);
    });

    DB::table('personal_access_tokens')
      ->where('tokenable_type', User::class)
      ->orderBy('id')
      ->chunk(500, static function ($tokens): void {
        $devices = $tokens->map(static fn($token): array => [
          'id' => (string)Str::uuid(),
          'user_id' => $token->tokenable_id,
          'personal_access_token_id' => $token->id,
          'ip' => $token->ip,
          'created_at' => $token->created_at,
          'updated_at' => $token->updated_at,
        ])->all();

        if ($devices !== []) {
          DB::table('devices')->insert($devices);
        }
      });

    Schema::table('personal_access_tokens', function (Blueprint $table) {
      $table->dropColumn('ip');
    });
  }

  public function down(): void {
    Schema::table('personal_access_tokens', function (Blueprint $table) {
      $table->string('ip', 45)->nullable()->after('name');
    });

    DB::table('devices')
      ->select(['personal_access_token_id', 'ip'])
      ->whereNotNull('ip')
      ->orderBy('id')
      ->chunk(500, static function ($devices): void {
        foreach ($devices as $device) {
          DB::table('personal_access_tokens')
            ->where('id', $device->personal_access_token_id)
            ->update(['ip' => $device->ip]);
        }
      });

    Schema::dropIfExists('devices');
  }
};
