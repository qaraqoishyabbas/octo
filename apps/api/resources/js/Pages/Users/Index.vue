<script setup>
import { computed, ref, watch } from "vue";
import { Head, Link, router } from "@inertiajs/vue3";
import { MoreHorizontal, Plus, Search } from "@lucide/vue";
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
import AdminUserFormDialog from "@/components/admin/AdminUserFormDialog.vue";
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
  users: {
    type: Object,
    required: true,
  },
  filters: {
    type: Object,
    default: () => ({
      search: "",
    }),
  },
});

const editingUser = ref(null);
const userDialogOpen = ref(false);
const deleteDialogOpen = ref(false);
const userPendingDelete = ref(null);
const search = ref(props.filters.search || "");

const usersList = computed(() => props.users.data || []);

watch(search, (value) => {
  router.get(
    "/users",
    { search: value },
    {
      preserveState: true,
      replace: true,
    },
  );
});

function resetForm() {
  editingUser.value = null;
}

function openCreateUserDialog() {
  resetForm();
  userDialogOpen.value = true;
}

function editUser(user) {
  editingUser.value = user;
  userDialogOpen.value = true;
}

function requestDestroyUser(user) {
  userPendingDelete.value = user;
  deleteDialogOpen.value = true;
}

function destroyUser() {
  if (!userPendingDelete.value) {
    return;
  }

  const user = userPendingDelete.value;

  router.delete(`/users/${user.id}`, {
    preserveScroll: true,
    onSuccess: () => {
      if (editingUser.value?.id === user.id) {
        resetForm();
      }
      deleteDialogOpen.value = false;
      userPendingDelete.value = null;
    },
  });
}

function statusFor(user) {
  return user.last_seen_at ? "Seen" : "Offline";
}

function initials(user) {
  return (user.name || user.username || "?").charAt(0).toUpperCase();
}
</script>

<template>
  <Head title="Users" />

  <AppLayout>
    <div class="space-y-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 class="text-3xl font-semibold tracking-normal">Users</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Manage chat accounts, profile data, and access credentials.
          </p>
        </div>

        <Button @click="openCreateUserDialog">
          <Plus class="size-4" />
          New user
        </Button>
      </div>

      <div class="grid gap-6">
        <Card>
          <CardHeader
            class="flex flex-col gap-3 border-b md:flex-row md:items-center"
          >
            <div>
              <CardTitle>Chat users</CardTitle>
              <CardDescription
                >{{ users.total }} total accounts</CardDescription
              >
            </div>

            <div class="relative w-full md:ml-auto md:max-w-sm">
              <Search
                class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                v-model="search"
                class="h-9 pl-9"
                placeholder="Search users"
              />
            </div>
          </CardHeader>

          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Dialogs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead class="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="user in usersList" :key="user.id">
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <Avatar class="size-9">
                        <AvatarFallback>{{ initials(user) }}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div class="font-medium">{{ user.name }}</div>
                        <div class="text-muted-foreground">
                          {{ user.email }}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="text-sm">{{ user.dialogs_count }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ user.authored_dialogs_count }} owned
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      :class="
                        user.last_seen_at
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : ''
                      "
                    >
                      {{ statusFor(user) }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-muted-foreground">{{
                    user.created_at
                  }}</TableCell>
                  <TableCell class="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Open user actions"
                        >
                          <MoreHorizontal class="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="end">
                        <DropdownMenuItem @click="editUser(user)"
                          >Edit user</DropdownMenuItem
                        >
                        <DropdownMenuItem
                          class="text-destructive"
                          @click="requestDestroyUser(user)"
                          >Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div
              v-if="users.links?.length"
              class="flex flex-wrap gap-2 border-t p-4"
            >
              <Button
                v-for="link in users.links"
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

        <AdminUserFormDialog
          v-model:open="userDialogOpen"
          :user="editingUser"
          @saved="resetForm"
        />

        <Dialog v-model:open="deleteDialogOpen">
          <DialogContent class="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Delete user</DialogTitle>
              <DialogDescription>
                Delete {{ userPendingDelete?.name || "this user" }}? This will
                remove the chat account.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                @click="deleteDialogOpen = false"
                >Cancel</Button
              >
              <Button type="button" variant="destructive" @click="destroyUser"
                >Delete</Button
              >
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </AppLayout>
</template>
