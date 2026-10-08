<?php

namespace Database\Factories;

use App\Enums\DialogType;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DialogFactory extends Factory {
  protected $model = Dialog::class;

  public function definition(): array {
    return [
      'author_id' => User::factory(),
      'title' => fake()->sentence(3),
      'description' => fake()->sentence(10),
      'type' => DialogType::DIRECT,
    ];
  }
}
