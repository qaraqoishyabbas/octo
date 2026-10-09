<?php

namespace Tests\Feature;

use Illuminate\Database\PostgresConnection;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MessageMigrationTest extends TestCase {
  public function test_postgres_creates_primary_key_before_self_referencing_foreign_key(): void {
    // Pretend mode compiles PostgreSQL SQL without executing it against this PDO.
    $connection = new PostgresConnection(new \PDO('sqlite::memory:'), 'migration_test');
    $connection->useDefaultSchemaGrammar();
    $originalSchema = Schema::getFacadeRoot();
    Schema::swap($connection->getSchemaBuilder());

    try {
      $migration = require database_path('migrations/2026_03_03_000001_create_messages_table.php');
      $queries = $connection->pretend(fn() => $migration->up());
    } finally {
      Schema::swap($originalSchema);
    }

    $sql = array_column($queries, 'query');
    $primary = array_find_key($sql, fn($query) => str_contains($query, 'primary key ("id")'));
    $reply = array_find_key($sql, fn($query) => str_contains($query, 'foreign key ("reply_to_id")'));

    $this->assertNotNull($primary, 'The messages primary key must be created.');
    $this->assertNotNull($reply, 'The reply foreign key must be created.');
    $this->assertLessThan($reply, $primary, 'PostgreSQL needs the primary key before the self-reference.');
    $this->assertStringContainsString('references "messages" ("id") on delete set null', $sql[$reply]);
  }
}
