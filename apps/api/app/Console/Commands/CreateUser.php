<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CreateUser extends Command {
  protected $signature = 'user:create {username : Логин нового пользователя}';

  protected $description = 'Создать пользователя по логину со случайным email';

  public function handle(): int {
    $username = trim((string)$this->argument('username'));
    $loginValidator = Validator::make(['username' => $username], [
      'username' => ['required', 'string', 'max:255', 'unique:users,username'],
    ], [
      'username.required' => 'Логин не должен быть пустым.',
      'username.max' => 'Логин не должен превышать 255 символов.',
      'username.unique' => 'Пользователь с таким логином уже существует.',
    ]);

    if ($loginValidator->fails()) {
      $this->error($loginValidator->errors()->first());
      return self::FAILURE;
    }

    $password = $this->secret('Пароль (минимум 8 символов)');
    $confirmation = $this->secret('Повторите пароль');
    $passwordValidator = Validator::make([
      'password' => $password,
      'password_confirmation' => $confirmation,
    ], [
      'password' => ['required', 'string', 'min:8', 'confirmed'],
    ], [
      'password.required' => 'Пароль не должен быть пустым.',
      'password.min' => 'Пароль должен содержать минимум 8 символов.',
      'password.confirmed' => 'Пароли не совпадают.',
    ]);

    if ($passwordValidator->fails()) {
      $this->error($passwordValidator->errors()->first());
      return self::FAILURE;
    }

    $user = User::create([
      'username' => $username,
      'first_name' => $username,
      'email' => Str::uuid() . '@example.invalid',
      'password' => $password,
    ]);

    $this->info('Пользователь создан.');
    $this->line('Логин: ' . $user->username);
    $this->line('Email для входа в админку: ' . $user->email);

    return self::SUCCESS;
  }
}
