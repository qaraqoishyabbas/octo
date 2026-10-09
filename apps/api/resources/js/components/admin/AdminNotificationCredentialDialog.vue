<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { router, useForm } from "@inertiajs/vue3";
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
const provider = ref("webpush");
const generating = ref(false);
const generationError = ref("");
let generationRequest = null;
const form = useForm({
  subject: "",
  public_key: "",
  private_key: "",
  project_id: "",
  client_email: "",
  team_id: "",
  key_id: "",
  bundle_id: "",
  sandbox: false,
});

const providers = computed(() => {
  if (props.app?.platform === "ios") return ["apns", "fcm"];
  if (props.app?.platform === "android") return ["fcm"];
  return ["webpush"];
});

function resetGeneration() {
  generationRequest?.abort();
  generationRequest = null;
  generating.value = false;
  generationError.value = "";
}

onBeforeUnmount(resetGeneration);

watch(
  () => [props.open, props.app],
  () => {
    resetGeneration();
    provider.value = providers.value[0];
    form.reset();
    form.clearErrors();
  },
  { immediate: true },
);

watch(provider, () => {
  resetGeneration();
  form.reset();
  form.clearErrors();
});

async function generateVapidKeys() {
  if (
    !props.app ||
    !props.open ||
    provider.value !== "webpush" ||
    generating.value ||
    form.processing
  )
    return;
  const appId = props.app.id;
  const request = new AbortController();
  generationRequest = request;
  generating.value = true;
  generationError.value = "";

  try {
    const xsrf = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1];
    const response = await fetch(`/notification-apps/${appId}/vapid-keys`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: request.signal,
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(xsrf ? { "X-XSRF-TOKEN": decodeURIComponent(xsrf) } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(
        response.status === 419
          ? "Сессия истекла. Обновите страницу и попробуйте снова."
          : "Не удалось создать VAPID-ключи. Попробуйте ещё раз.",
      );
    }
    const keys = await response.json();
    if (!keys.public_key || !keys.private_key)
      throw new Error("Сервер не вернул VAPID-ключи.");
    if (
      generationRequest !== request ||
      !props.open ||
      props.app?.id !== appId ||
      provider.value !== "webpush"
    )
      return;
    form.public_key = keys.public_key;
    form.private_key = keys.private_key;
    form.clearErrors("public_key", "private_key");
  } catch (error) {
    if (generationRequest === request && error.name !== "AbortError") {
      generationError.value =
        error instanceof TypeError
          ? "Не удалось связаться с сервером. Обновите страницу и попробуйте снова."
          : error.message;
    }
  } finally {
    if (generationRequest === request) {
      generationRequest = null;
      generating.value = false;
    }
  }
}

function configured(name) {
  return (props.app?.credentials || []).some((item) => item.provider === name);
}

function submit() {
  if (!props.app || generating.value) return;
  form.put(`/notification-apps/${props.app.id}/credentials/${provider.value}`, {
    preserveScroll: true,
    onSuccess: () => {
      form.reset();
      emit("update:open", false);
    },
  });
}

function removeCredentials() {
  if (!props.app || !configured(provider.value)) return;
  router.delete(
    `/notification-apps/${props.app.id}/credentials/${provider.value}`,
    {
      preserveScroll: true,
      onSuccess: () => emit("update:open", false),
    },
  );
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[600px]"
    >
      <DialogHeader>
        <DialogTitle>Credentials: {{ app?.name }}</DialogTitle>
        <DialogDescription>
          Приватный ключ сохраняется зашифрованным. Для замены введите весь
          набор заново.
        </DialogDescription>
      </DialogHeader>

      <form
        id="notification-credentials-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div class="grid gap-2">
          <Label for="notification-provider">Провайдер</Label>
          <select
            id="notification-provider"
            v-model="provider"
            class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option v-for="item in providers" :key="item" :value="item">
              {{ item.toUpperCase() }}
            </option>
          </select>
          <p v-if="configured(provider)" class="text-xs text-emerald-600">
            Настроен · повторное сохранение заменит credentials
          </p>
          <p v-if="form.errors.provider" class="text-sm text-destructive">
            {{ form.errors.provider }}
          </p>
        </div>

        <template v-if="provider === 'webpush'">
          <div class="space-y-2">
            <Button
              type="button"
              variant="outline"
              :disabled="generating || form.processing"
              @click="generateVapidKeys"
            >
              {{ generating ? "Генерация…" : "Сгенерировать VAPID-ключи" }}
            </Button>
            <p class="text-sm text-muted-foreground">
              Ключи появятся в полях ниже. Укажите subject и нажмите
              «Сохранить», чтобы применить их.
            </p>
            <p
              v-if="configured('webpush')"
              class="text-sm text-muted-foreground"
            >
              После замены сохранённых VAPID-ключей пользователям потребуется
              заново включить уведомления.
            </p>
            <p
              v-if="generationError"
              class="text-sm text-destructive"
              role="alert"
            >
              {{ generationError }}
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="notification-subject">VAPID subject</Label>
            <Input
              id="notification-subject"
              v-model="form.subject"
              placeholder="mailto:admin@example.com"
            />
            <p v-if="form.errors.subject" class="text-sm text-destructive">
              {{ form.errors.subject }}
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="notification-public-key">Public key</Label>
            <Input
              id="notification-public-key"
              v-model="form.public_key"
              autocomplete="off"
            />
            <p v-if="form.errors.public_key" class="text-sm text-destructive">
              {{ form.errors.public_key }}
            </p>
          </div>
        </template>

        <template v-if="provider === 'fcm'">
          <div class="grid gap-2">
            <Label for="notification-project-id">Firebase project ID</Label>
            <Input
              id="notification-project-id"
              v-model="form.project_id"
              autocomplete="off"
            />
            <p v-if="form.errors.project_id" class="text-sm text-destructive">
              {{ form.errors.project_id }}
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="notification-client-email">Service account email</Label>
            <Input
              id="notification-client-email"
              v-model="form.client_email"
              autocomplete="off"
            />
            <p v-if="form.errors.client_email" class="text-sm text-destructive">
              {{ form.errors.client_email }}
            </p>
          </div>
        </template>

        <template v-if="provider === 'apns'">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label for="notification-team-id">Apple team ID</Label>
              <Input
                id="notification-team-id"
                v-model="form.team_id"
                autocomplete="off"
              />
              <p v-if="form.errors.team_id" class="text-sm text-destructive">
                {{ form.errors.team_id }}
              </p>
            </div>
            <div class="grid gap-2">
              <Label for="notification-key-id">Key ID</Label>
              <Input
                id="notification-key-id"
                v-model="form.key_id"
                autocomplete="off"
              />
              <p v-if="form.errors.key_id" class="text-sm text-destructive">
                {{ form.errors.key_id }}
              </p>
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="notification-bundle-id">Bundle ID</Label>
            <Input
              id="notification-bundle-id"
              v-model="form.bundle_id"
              autocomplete="off"
            />
            <p v-if="form.errors.bundle_id" class="text-sm text-destructive">
              {{ form.errors.bundle_id }}
            </p>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.sandbox" type="checkbox" class="size-4" />
            Использовать APNs Sandbox
          </label>
        </template>

        <div class="grid gap-2">
          <Label for="notification-private-key">Private key</Label>
          <textarea
            id="notification-private-key"
            v-model="form.private_key"
            class="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
            autocomplete="off"
            spellcheck="false"
            placeholder="Вставьте приватный ключ"
          />
          <p v-if="form.errors.private_key" class="text-sm text-destructive">
            {{ form.errors.private_key }}
          </p>
        </div>
      </form>

      <DialogFooter class="gap-2">
        <Button
          v-if="configured(provider)"
          type="button"
          variant="destructive"
          class="sm:mr-auto"
          @click="removeCredentials"
          >Удалить ключи</Button
        >
        <Button
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
          >Отмена</Button
        >
        <Button
          type="submit"
          form="notification-credentials-form"
          :disabled="form.processing || generating"
        >
          {{ form.processing ? "Сохранение…" : "Сохранить" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
