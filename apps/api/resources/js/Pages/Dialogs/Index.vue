<script setup>
import { computed, ref, watch } from "vue";
import { Head, Link, router } from "@inertiajs/vue3";
import {
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
} from "@lucide/vue";
import AppLayout from "@/Layouts/AppLayout.vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AdminDialogManagementDialog from "@/components/admin/AdminDialogManagementDialog.vue";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const props = defineProps({
  kind: {
    type: Object,
    required: true,
  },
  dialogs: {
    type: Object,
    required: true,
  },
  selectedDialog: {
    type: Object,
    default: null,
  },
  users: {
    type: Array,
    default: () => [],
  },
  roles: {
    type: Array,
    default: () => [],
  },
  filters: {
    type: Object,
    default: () => ({
      search: "",
    }),
  },
});

const search = ref(props.filters.search || "");
const dialogOpen = ref(false);
const dialogMode = ref("edit");
const confirmationDialogOpen = ref(false);
const confirmation = ref({
  title: "",
  description: "",
  confirmText: "Confirm",
  onConfirm: null,
});
const dialogIcon = computed(() =>
  props.kind.type === "C" ? Radio : MessageSquare,
);
const dialogsList = computed(() => props.dialogs.data || []);

watch(search, (value) => {
  router.get(
    window.location.pathname,
    { search: value, dialog: props.selectedDialog?.id },
    {
      preserveState: true,
      replace: true,
    },
  );
});

function selectDialog(dialog) {
  dialogMode.value = "edit";
  dialogOpen.value = true;

  router.get(
    window.location.pathname,
    { search: search.value, dialog: dialog.id },
    {
      preserveState: true,
      preserveScroll: true,
    },
  );
}

function openCreateDialog() {
  dialogMode.value = "create";
  dialogOpen.value = true;
}

function requestConfirmation({ title, description, confirmText, onConfirm }) {
  confirmation.value = {
    title,
    description,
    confirmText,
    onConfirm,
  };
  confirmationDialogOpen.value = true;
}

function confirmAction() {
  const action = confirmation.value.onConfirm;

  if (action) {
    action();
  }

  confirmationDialogOpen.value = false;
}

function destroyDialog(dialog = props.selectedDialog) {
  if (!dialog) {
    return;
  }

  requestConfirmation({
    title: `Delete ${props.kind.label.toLowerCase()}`,
    description: `Delete ${dialog.title}? Messages and memberships for this ${props.kind.label.toLowerCase()} will be removed.`,
    confirmText: "Delete",
    onConfirm: () => {
      router.delete(`/dialogs/${dialog.id}`, {
        preserveScroll: true,
        onSuccess: () => {
          dialogOpen.value = false;
        },
      });
    },
  });
}

function removeMember({ dialog, member }) {
  requestConfirmation({
    title: "Remove member",
    description: `Remove ${member.name} from ${dialog.title}?`,
    confirmText: "Remove",
    onConfirm: () => {
      router.delete(`/dialogs/${dialog.id}/members/${member.id}`, {
        preserveScroll: true,
      });
    },
  });
}

function initials(user) {
  return (user?.name || user?.username || "?").charAt(0).toUpperCase();
}
</script>

<template>
  <Head :title="kind.plural" />

  <AppLayout>
    <div class="space-y-6">
      <div
        class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="grid size-10 place-items-center rounded-md border bg-background"
          >
            <component :is="dialogIcon" class="size-5" />
          </div>
          <div>
            <h1 class="text-3xl font-semibold tracking-normal">
              {{ kind.plural }}
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Moderate ownership, members, and chat surface settings.
            </p>
          </div>
        </div>

        <Button @click="openCreateDialog">
          <Plus class="size-4" />
          New {{ kind.label.toLowerCase() }}
        </Button>
      </div>

      <Card>
        <CardHeader
          class="flex flex-col gap-3 border-b lg:flex-row lg:items-center"
        >
          <div>
            <CardTitle>{{ kind.plural }} directory</CardTitle>
            <CardDescription
              >{{ dialogs.total }} active
              {{ kind.plural.toLowerCase() }}</CardDescription
            >
          </div>

          <div class="relative w-full lg:ml-auto lg:max-w-sm">
            <Search
              class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="search"
              class="h-9 pl-9"
              :placeholder="`Search ${kind.plural.toLowerCase()}`"
            />
          </div>
        </CardHeader>

        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead>{{ kind.label }}</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Created</TableHead>
                <TableHead class="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="dialog in dialogsList"
                :key="dialog.id"
                class="cursor-pointer"
                :class="selectedDialog?.id === dialog.id ? 'bg-muted/60' : ''"
                @click="selectDialog(dialog)"
              >
                <TableCell>
                  <div class="font-medium">{{ dialog.title }}</div>
                  <div
                    class="max-w-[320px] truncate text-xs text-muted-foreground"
                  >
                    {{ dialog.description || dialog.dialog_id }}
                  </div>
                </TableCell>
                <TableCell>
                  <div v-if="dialog.owner" class="flex items-center gap-2">
                    <Avatar class="size-7">
                      <AvatarFallback>{{
                        initials(dialog.owner)
                      }}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div class="text-sm font-medium">
                        {{ dialog.owner.name }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        @{{ dialog.owner.username }}
                      </div>
                    </div>
                  </div>
                  <Badge v-else variant="outline">No owner</Badge>
                </TableCell>
                <TableCell>{{ dialog.users_count }}</TableCell>
                <TableCell>{{ dialog.messages_count }}</TableCell>
                <TableCell class="text-muted-foreground">{{
                  dialog.created_at
                }}</TableCell>
                <TableCell class="text-right" @click.stop>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Open dialog actions"
                      >
                        <MoreHorizontal class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="end">
                      <DropdownMenuItem @click="selectDialog(dialog)"
                        >Open modal</DropdownMenuItem
                      >
                      <DropdownMenuItem
                        class="text-destructive"
                        @click="destroyDialog(dialog)"
                        >Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div
            v-if="dialogs.links?.length"
            class="flex flex-wrap gap-2 border-t p-4"
          >
            <Button
              v-for="link in dialogs.links"
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

      <AdminDialogManagementDialog
        v-model:open="dialogOpen"
        :kind="kind"
        :mode="dialogMode"
        :selected-dialog="selectedDialog"
        :users="users"
        :roles="roles"
        @delete="destroyDialog"
        @remove-member="removeMember"
      />

      <Dialog v-model:open="confirmationDialogOpen">
        <DialogContent class="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{{ confirmation.title }}</DialogTitle>
            <DialogDescription>{{
              confirmation.description
            }}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="confirmationDialogOpen = false"
              >Cancel</Button
            >
            <Button type="button" variant="destructive" @click="confirmAction">
              {{ confirmation.confirmText }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </AppLayout>
</template>
