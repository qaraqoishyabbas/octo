<script setup>
import { computed, watch } from "vue";
import { useForm } from "@inertiajs/vue3";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const props = defineProps({
  open: { type: Boolean, default: false },
  app: { type: Object, default: null },
});
const emit = defineEmits(["update:open"]);
const form = useForm({ name: "", platform: "web" });
const editing = computed(() => Boolean(props.app));

watch(
  () => [props.open, props.app],
  () => {
    form.defaults({
      name: props.app?.name || "",
      platform: props.app?.platform || "web",
    });
    form.reset();
    form.clearErrors();
  },
  { immediate: true },
);

function submit() {
  const options = {
    preserveScroll: true,
    onSuccess: () => emit("update:open", false),
  };
  if (editing.value) {
    form.patch(`/notification-apps/${props.app.id}`, options);
  } else {
    form.post("/notification-apps", options);
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{{
          editing ? "Изменить приложение" : "Добавить приложение"
        }}</DialogTitle>
        <DialogDescription>
          Выберите платформу, для которой будут регистрироваться push-токены.
        </DialogDescription>
      </DialogHeader>

      <form
        id="notification-app-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div class="grid gap-2">
          <Label for="notification-app-name">Название</Label>
          <Input
            id="notification-app-name"
            v-model="form.name"
            placeholder="Например, Octo Web"
            maxlength="100"
          />
          <p v-if="form.errors.name" class="text-sm text-destructive">
            {{ form.errors.name }}
          </p>
        </div>
        <div class="grid gap-2">
          <Label for="notification-app-platform">Платформа</Label>
          <select
            id="notification-app-platform"
            v-model="form.platform"
            :disabled="editing"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            <option value="web">Web</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="desktopapp">Desktop app</option>
          </select>
          <p v-if="form.errors.platform" class="text-sm text-destructive">
            {{ form.errors.platform }}
          </p>
          <p v-if="editing" class="text-xs text-muted-foreground">
            Платформу существующего приложения изменить нельзя.
          </p>
        </div>
      </form>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
          >Отмена</Button
        >
        <Button
          type="submit"
          form="notification-app-form"
          :disabled="form.processing"
        >
          {{
            form.processing ? "Сохранение…" : editing ? "Сохранить" : "Добавить"
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
