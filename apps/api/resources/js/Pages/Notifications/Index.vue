<script setup>
import { computed, ref } from "vue";
import { Head, Link, router } from "@inertiajs/vue3";
import { BellRing, Copy, KeyRound, Pencil, Plus, Trash2 } from "@lucide/vue";
import AppLayout from "@/Layouts/AppLayout.vue";
import AdminNotificationAppDialog from "@/components/admin/AdminNotificationAppDialog.vue";
import AdminNotificationCredentialDialog from "@/components/admin/AdminNotificationCredentialDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const props = defineProps({
  apps: { type: Object, required: true },
});
const rows = computed(() => props.apps.data || []);
const appDialogOpen = ref(false);
const credentialsDialogOpen = ref(false);
const deleteDialogOpen = ref(false);
const selectedApp = ref(null);
const deletingApp = ref(null);
const copiedId = ref("");

function createApp() {
  selectedApp.value = null;
  appDialogOpen.value = true;
}

function editApp(app) {
  selectedApp.value = app;
  appDialogOpen.value = true;
}

function configure(app) {
  selectedApp.value = app;
  credentialsDialogOpen.value = true;
}

function toggle(app) {
  router.patch(
    `/notification-apps/${app.id}`,
    { enabled: !app.enabled },
    { preserveScroll: true },
  );
}

function requestDelete(app) {
  deletingApp.value = app;
  deleteDialogOpen.value = true;
}

function deleteApp() {
  if (!deletingApp.value) return;
  router.delete(`/notification-apps/${deletingApp.value.id}`, {
    preserveScroll: true,
    onSuccess: () => {
      deleteDialogOpen.value = false;
      deletingApp.value = null;
    },
  });
}

async function copyId(id) {
  try {
    await navigator.clipboard.writeText(id);
    copiedId.value = id;
    window.setTimeout(() => {
      copiedId.value = "";
    }, 2000);
  } catch {
    copiedId.value = "";
  }
}
</script>

<template>
  <Head title="Приложения уведомлений" />
  <AppLayout>
    <div class="space-y-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 class="text-3xl font-semibold tracking-normal">
            Приложения уведомлений
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Зарегистрируйте клиент, добавьте ключи провайдера и используйте ID
            для регистрации push-токенов.
          </p>
        </div>
        <Button @click="createApp"
          ><Plus class="size-4" /> Добавить приложение</Button
        >
      </div>

      <Card>
        <CardHeader class="border-b">
          <CardTitle class="flex items-center gap-2"
            ><BellRing class="size-5" /> Подключённые приложения</CardTitle
          >
          <CardDescription>{{ apps.total }} приложений</CardDescription>
        </CardHeader>
        <CardContent class="p-0">
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Приложение</TableHead>
                  <TableHead>Платформа</TableHead>
                  <TableHead>Провайдеры</TableHead>
                  <TableHead>Токены</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead class="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="app in rows" :key="app.id">
                  <TableCell>
                    <div class="font-medium">{{ app.name }}</div>
                    <button
                      class="mt-1 flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                      @click="copyId(app.id)"
                    >
                      {{ app.id }} <Copy class="size-3" />
                    </button>
                    <span
                      v-if="copiedId === app.id"
                      class="text-xs text-emerald-600"
                      >Скопировано</span
                    >
                  </TableCell>
                  <TableCell class="uppercase">{{ app.platform }}</TableCell>
                  <TableCell>
                    <div
                      v-if="app.credentials.length"
                      class="flex flex-wrap gap-1"
                    >
                      <Badge
                        v-for="credential in app.credentials"
                        :key="credential.provider"
                        variant="secondary"
                      >
                        {{ credential.provider.toUpperCase() }}
                      </Badge>
                    </div>
                    <span v-else class="text-sm text-muted-foreground"
                      >Не настроены</span
                    >
                  </TableCell>
                  <TableCell>{{ app.push_tokens_count }}</TableCell>
                  <TableCell>
                    <Badge :variant="app.enabled ? 'default' : 'outline'">
                      {{ app.enabled ? "Активно" : "Выключено" }}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div class="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        @click="configure(app)"
                      >
                        <KeyRound class="size-4" /> Credentials
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        :aria-label="`Изменить ${app.name}`"
                        @click="editApp(app)"
                      >
                        <Pencil class="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" @click="toggle(app)">
                        {{ app.enabled ? "Выключить" : "Включить" }}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        :aria-label="`Удалить ${app.name}`"
                        @click="requestDelete(app)"
                      >
                        <Trash2 class="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-if="rows.length === 0">
                  <TableCell
                    colspan="6"
                    class="py-12 text-center text-muted-foreground"
                  >
                    Пока нет приложений. Нажмите «Добавить приложение», чтобы
                    начать.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div
            v-if="apps.links?.length > 3"
            class="flex flex-wrap gap-2 border-t p-4"
          >
            <Button
              v-for="link in apps.links"
              :key="link.label"
              :as="Link"
              :href="link.url || '#'"
              :disabled="!link.url"
              :variant="link.active ? 'default' : 'outline'"
              size="sm"
              v-html="link.label"
            />
          </div>
        </CardContent>
      </Card>

      <AdminNotificationAppDialog
        v-model:open="appDialogOpen"
        :app="selectedApp"
      />
      <AdminNotificationCredentialDialog
        v-model:open="credentialsDialogOpen"
        :app="selectedApp"
      />

      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent class="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Удалить приложение?</DialogTitle>
            <DialogDescription>
              {{ deletingApp?.name }} и все его credentials, push-токены и
              записи доставок будут удалены.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="deleteDialogOpen = false"
              >Отмена</Button
            >
            <Button type="button" variant="destructive" @click="deleteApp"
              >Удалить</Button
            >
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </AppLayout>
</template>
