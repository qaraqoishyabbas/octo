<?php

namespace Database\Factories;

use App\Models\Message;
use App\Models\Dialog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class MessageFactory extends Factory {
  protected $model = Message::class;

  public function definition(): array {
    return [
      'dialog_id' => Dialog::factory(),
      'sender_id' => User::factory(),
      'message' => $this->faker->realText(
        $this->faker->numberBetween(20, 1000)
      ),
    ];
  }
}
