<script setup>
import { Head, Link, useForm } from "@inertiajs/vue3";
import AppLayout from "@/Layouts/AppLayout.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const form = useForm({
  username: "",
  password: "",
  password_confirmation: "",
});

function submit() {
  form.post("/users", {
    onFinish: () => form.reset("password", "password_confirmation"),
  });
}
</script>

<template>
  <Head title="Регистрация пользователя" />
  <AppLayout>
    <Card class="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle>Регистрация пользователя</CardTitle>
        <CardDescription>
          Создайте аккаунт по логину. Email будет создан автоматически.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="grid gap-2">
            <Label for="username">Логин</Label>
            <Input
              id="username"
              v-model="form.username"
              autocomplete="off"
              maxlength="255"
              required
            />
            <p
              v-if="form.errors.username"
              class="text-sm text-destructive"
              role="alert"
            >
              {{ form.errors.username }}
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="password">Пароль</Label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
            <p class="text-sm text-muted-foreground">Минимум 8 символов.</p>
            <p
              v-if="form.errors.password"
              class="text-sm text-destructive"
              role="alert"
            >
              {{ form.errors.password }}
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="password_confirmation">Повторите пароль</Label>
            <Input
              id="password_confirmation"
              v-model="form.password_confirmation"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>
          <div class="flex gap-2">
            <Button type="submit" :disabled="form.processing">
              {{ form.processing ? "Создание..." : "Создать пользователя" }}
            </Button>
            <Button :as="Link" href="/users" variant="outline">Отмена</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </AppLayout>
</template>
