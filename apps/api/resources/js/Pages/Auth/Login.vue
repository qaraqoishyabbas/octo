<script setup>
import { Head, useForm } from "@inertiajs/vue3";
import { Boxes, GitBranch } from "@lucide/vue";
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
import { Separator } from "@/components/ui/separator";

const form = useForm({
  email: "",
  password: "",
  remember: false,
});

function submit() {
  form.post("/login", {
    preserveScroll: true,
  });
}
</script>

<template>
  <Head title="Login" />

  <main class="grid min-h-screen bg-background lg:grid-cols-2">
    <section
      class="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex"
    >
      <div
        class="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_34%),radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.35),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(244,63,94,0.24),transparent_28%)]"
      />

      <a
        href="/dashboard"
        class="relative z-10 flex items-center gap-2 text-lg font-semibold"
      >
        <Boxes class="size-6" />
        Octo
      </a>

      <div class="relative z-10 max-w-lg">
        <blockquote class="space-y-3">
          <p class="text-xl leading-8">
            Build operational interfaces with the calm density of Laravel,
            Inertia, Vue, and shadcn-style components.
          </p>
          <footer class="text-sm text-zinc-300">
            Internal platform template
          </footer>
        </blockquote>
      </div>
    </section>

    <section class="flex items-center justify-center px-6 py-12">
      <Card class="w-full max-w-sm border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription
            >Enter your email to sign in to your workspace.</CardDescription
          >
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="submit">
            <div class="grid gap-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                placeholder="name@example.com"
              />
              <p v-if="form.errors.email" class="text-sm text-destructive">
                {{ form.errors.email }}
              </p>
            </div>

            <div class="grid gap-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                v-model="form.password"
                type="password"
                autocomplete="current-password"
                placeholder="••••••••"
              />
              <p v-if="form.errors.password" class="text-sm text-destructive">
                {{ form.errors.password }}
              </p>
            </div>

            <label
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <input
                v-model="form.remember"
                type="checkbox"
                class="size-4 rounded border-input"
              />
              Remember this device
            </label>

            <Button class="w-full" :disabled="form.processing">
              {{ form.processing ? "Signing in..." : "Continue with email" }}
            </Button>

            <div class="flex items-center gap-3">
              <Separator class="flex-1" />
              <span class="text-xs text-muted-foreground">or</span>
              <Separator class="flex-1" />
            </div>
            <Button type="button" variant="outline" class="w-full">
              <GitBranch class="size-4" />
              Continue with SSO
            </Button>

            <p class="px-6 text-center text-sm leading-6 text-muted-foreground">
              By continuing, you agree to the Terms of Service and Privacy
              Policy.
            </p>
          </form>
        </CardContent>
      </Card>
    </section>
  </main>
</template>
