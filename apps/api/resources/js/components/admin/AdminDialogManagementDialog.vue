<script setup>
import { computed, reactive, watch } from "vue";
import { useForm } from "@inertiajs/vue3";
import {
  Crown,
  MessageSquare,
  Plus,
  Shield,
  UserPlus,
  Users,
} from "@lucide/vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  open: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: "edit",
  },
  kind: {
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
});

const emit = defineEmits(["update:open", "delete", "remove-member"]);

const memberForms = reactive({});
const isCreateDialog = computed(() => props.mode === "create");
const selectedMembers = computed(() => props.selectedDialog?.members || []);
const availableMemberRoles = computed(() =>
  props.roles.filter((role) => role !== "owner"),
);
const ownerOptions = computed(() => {
  const ids = new Set(props.users.map((user) => user.id));
  const currentOwner = props.selectedDialog?.owner;

  if (currentOwner && !ids.has(currentOwner.id)) {
    return [currentOwner, ...props.users];
  }

  return props.users;
});

const createForm = useForm({
  title: "",
  description: "",
  owner_id: "",
});

const editForm = useForm({
  title: "",
  description: "",
});

const ownerForm = useForm({
  owner_id: "",
});

const addMemberForm = useForm({
  user_id: "",
  role: "member",
});

watch(
  () => [props.open, props.mode],
  () => {
    if (isCreateDialog.value) {
      createForm.reset();
      createForm.clearErrors();
    }
  },
  { immediate: true },
);

watch(
  () => props.selectedDialog,
  (dialog) => {
    editForm.defaults({
      title: dialog?.title || "",
      description: dialog?.description || "",
    });
    editForm.reset();
    editForm.clearErrors();

    ownerForm.defaults({
      owner_id: dialog?.owner_id || "",
    });
    ownerForm.reset();
    ownerForm.clearErrors();
  },
  { immediate: true },
);

function createDialog() {
  createForm.post(props.kind.storeUrl, {
    preserveScroll: true,
    onSuccess: () => {
      createForm.reset();
      emit("update:open", false);
    },
  });
}

function updateDialog() {
  if (!props.selectedDialog) {
    return;
  }

  editForm.put(`/dialogs/${props.selectedDialog.id}`, {
    preserveScroll: true,
    onSuccess: () => {
      emit("update:open", false);
    },
  });
}

function changeOwner() {
  if (!props.selectedDialog) {
    return;
  }

  ownerForm.put(`/dialogs/${props.selectedDialog.id}/owner`, {
    preserveScroll: true,
  });
}

function addMember() {
  if (!props.selectedDialog) {
    return;
  }

  addMemberForm.post(`/dialogs/${props.selectedDialog.id}/members`, {
    preserveScroll: true,
    onSuccess: () => addMemberForm.reset(),
  });
}

function memberForm(member) {
  if (!memberForms[member.id]) {
    memberForms[member.id] = useForm({
      role: member.role || "member",
      muted: Boolean(member.muted),
      pinned: Boolean(member.pinned),
    });
  }

  return memberForms[member.id];
}

function updateMember(member) {
  memberForm(member).put(
    `/dialogs/${props.selectedDialog.id}/members/${member.id}`,
    {
      preserveScroll: true,
    },
  );
}

function removeMember(member) {
  if (!props.selectedDialog) {
    return;
  }

  emit("remove-member", { dialog: props.selectedDialog, member });
}

function roleVariant(role) {
  if (role === "owner") {
    return "default";
  }

  if (role === "admin") {
    return "secondary";
  }

  return "outline";
}

function initials(user) {
  return (user?.name || user?.username || "?").charAt(0).toUpperCase();
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl lg:max-w-4xl"
    >
      <DialogHeader>
        <DialogTitle>
          {{
            isCreateDialog
              ? `Create ${kind.label.toLowerCase()}`
              : selectedDialog
                ? selectedDialog.title
                : `Select ${kind.label.toLowerCase()}`
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            isCreateDialog
              ? "Prepare a chat surface and assign an initial owner."
              : selectedDialog
                ? selectedDialog.dialog_id
                : `Choose a ${kind.label.toLowerCase()} to open moderation tools.`
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-6">
        <form
          v-if="isCreateDialog"
          id="create-dialog-form"
          class="space-y-4"
          @submit.prevent="createDialog"
        >
          <div class="grid gap-2">
            <Label for="create_title">Title</Label>
            <Input id="create_title" v-model="createForm.title" />
            <p v-if="createForm.errors.title" class="text-sm text-destructive">
              {{ createForm.errors.title }}
            </p>
          </div>

          <div class="grid gap-2">
            <Label for="create_owner">Owner</Label>
            <select
              id="create_owner"
              v-model="createForm.owner_id"
              class="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No owner</option>
              <option v-for="user in users" :key="user.id" :value="user.id">
                {{ user.name }} · @{{ user.username }}
              </option>
            </select>
            <p
              v-if="createForm.errors.owner_id"
              class="text-sm text-destructive"
            >
              {{ createForm.errors.owner_id }}
            </p>
          </div>

          <div class="grid gap-2">
            <Label for="create_description">Description</Label>
            <textarea
              id="create_description"
              v-model="createForm.description"
              class="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p
              v-if="createForm.errors.description"
              class="text-sm text-destructive"
            >
              {{ createForm.errors.description }}
            </p>
          </div>
        </form>

        <template v-else-if="selectedDialog">
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-md border p-3">
              <div
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Users class="size-4" />
                Members
              </div>
              <div class="mt-2 text-2xl font-semibold">
                {{ selectedDialog.users_count }}
              </div>
            </div>
            <div class="rounded-md border p-3">
              <div
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <MessageSquare class="size-4" />
                Messages
              </div>
              <div class="mt-2 text-2xl font-semibold">
                {{ selectedDialog.messages_count }}
              </div>
            </div>
            <div class="rounded-md border p-3">
              <div
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Crown class="size-4" />
                Owner
              </div>
              <div class="mt-2 truncate text-sm font-semibold">
                {{ selectedDialog.owner?.name || "None" }}
              </div>
            </div>
          </div>

          <form
            class="space-y-4 rounded-md border p-4"
            @submit.prevent="updateDialog"
          >
            <div class="grid gap-2">
              <Label for="edit_title">Title</Label>
              <Input id="edit_title" v-model="editForm.title" />
              <p v-if="editForm.errors.title" class="text-sm text-destructive">
                {{ editForm.errors.title }}
              </p>
            </div>

            <div class="grid gap-2">
              <Label for="edit_description">Description</Label>
              <textarea
                id="edit_description"
                v-model="editForm.description"
                class="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p
                v-if="editForm.errors.description"
                class="text-sm text-destructive"
              >
                {{ editForm.errors.description }}
              </p>
            </div>

            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="destructive"
                @click="emit('delete', selectedDialog)"
                >Delete</Button
              >
              <Button type="submit" :disabled="editForm.processing"
                >Save details</Button
              >
            </div>
          </form>

          <section class="space-y-3 rounded-md border p-4">
            <div>
              <h2 class="text-sm font-semibold">Ownership</h2>
              <p class="text-sm text-muted-foreground">
                Transfer operational control without touching the API layer.
              </p>
            </div>
            <form
              class="flex flex-col gap-3 sm:flex-row sm:items-end"
              @submit.prevent="changeOwner"
            >
              <div class="grid flex-1 gap-2">
                <Label for="owner_id">Owner</Label>
                <select
                  id="owner_id"
                  v-model="ownerForm.owner_id"
                  class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select owner</option>
                  <option
                    v-for="user in ownerOptions"
                    :key="user.id"
                    :value="user.id"
                  >
                    {{ user.name }} · @{{ user.username }}
                  </option>
                </select>
                <p
                  v-if="ownerForm.errors.owner_id"
                  class="text-sm text-destructive"
                >
                  {{ ownerForm.errors.owner_id }}
                </p>
              </div>
              <Button type="submit" :disabled="ownerForm.processing">
                <Crown class="size-4" />
                Change owner
              </Button>
            </form>
          </section>

          <section class="space-y-5 rounded-md border p-4">
            <div>
              <h2 class="text-sm font-semibold">Members</h2>
              <p class="text-sm text-muted-foreground">
                Add moderators, tune roles, and set user-level chat flags.
              </p>
            </div>
            <form
              class="grid gap-3 lg:grid-cols-[1fr_150px_auto]"
              @submit.prevent="addMember"
            >
              <div class="grid gap-2">
                <Label for="member_user">User</Label>
                <select
                  id="member_user"
                  v-model="addMemberForm.user_id"
                  class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select user</option>
                  <option v-for="user in users" :key="user.id" :value="user.id">
                    {{ user.name }} · @{{ user.username }}
                  </option>
                </select>
                <p
                  v-if="addMemberForm.errors.user_id"
                  class="text-sm text-destructive"
                >
                  {{ addMemberForm.errors.user_id }}
                </p>
              </div>

              <div class="grid gap-2">
                <Label for="member_role">Role</Label>
                <select
                  id="member_role"
                  v-model="addMemberForm.role"
                  class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option
                    v-for="role in availableMemberRoles"
                    :key="role"
                    :value="role"
                  >
                    {{ role }}
                  </option>
                </select>
                <p
                  v-if="addMemberForm.errors.role"
                  class="text-sm text-destructive"
                >
                  {{ addMemberForm.errors.role }}
                </p>
              </div>

              <div class="flex items-end">
                <Button
                  type="submit"
                  class="w-full lg:w-auto"
                  :disabled="addMemberForm.processing"
                >
                  <UserPlus class="size-4" />
                  Add
                </Button>
              </div>
            </form>

            <div class="space-y-3">
              <div
                v-for="member in selectedMembers"
                :key="member.id"
                class="rounded-md border p-3"
              >
                <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar class="size-9">
                      <AvatarFallback>{{ initials(member) }}</AvatarFallback>
                    </Avatar>
                    <div class="min-w-0">
                      <div class="truncate font-medium">{{ member.name }}</div>
                      <div class="truncate text-xs text-muted-foreground">
                        {{ member.email }}
                      </div>
                    </div>
                    <Badge
                      :variant="roleVariant(member.role)"
                      class="ml-auto xl:ml-0"
                    >
                      <Shield class="size-3" />
                      {{ member.role }}
                    </Badge>
                  </div>

                  <div
                    class="grid gap-3 sm:grid-cols-[130px_auto_auto_auto] sm:items-center"
                  >
                    <select
                      v-model="memberForm(member).role"
                      class="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      :disabled="member.role === 'owner'"
                    >
                      <option
                        v-for="role in availableMemberRoles"
                        :key="role"
                        :value="role"
                      >
                        {{ role }}
                      </option>
                      <option v-if="member.role === 'owner'" value="owner">
                        owner
                      </option>
                    </select>

                    <label class="flex items-center gap-2 text-sm">
                      <input
                        v-model="memberForm(member).muted"
                        type="checkbox"
                        class="size-4 rounded border-input"
                      />
                      Muted
                    </label>

                    <label class="flex items-center gap-2 text-sm">
                      <input
                        v-model="memberForm(member).pinned"
                        type="checkbox"
                        class="size-4 rounded border-input"
                      />
                      Pinned
                    </label>

                    <div class="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        :disabled="member.role === 'owner'"
                        @click="updateMember(member)"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        class="text-destructive"
                        :disabled="member.role === 'owner'"
                        @click="removeMember(member)"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
                <p
                  v-if="memberForm(member).errors.role"
                  class="mt-2 text-sm text-destructive"
                >
                  {{ memberForm(member).errors.role }}
                </p>
              </div>
            </div>
          </section>
        </template>

        <div
          v-else
          class="rounded-md border border-dashed p-6 text-sm text-muted-foreground"
        >
          Select a {{ kind.label.toLowerCase() }} from the directory to open
          editing tools.
        </div>
      </div>

      <DialogFooter v-if="isCreateDialog" class="border-t pt-4">
        <Button
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
          >Cancel</Button
        >
        <Button
          type="submit"
          form="create-dialog-form"
          :disabled="createForm.processing"
        >
          <Plus class="size-4" />
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
