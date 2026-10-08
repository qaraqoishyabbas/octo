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
  open: {
    type: Boolean,
    default: false,
  },
  user: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["update:open", "saved"]);

const initialFormData = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  bio: "",
  birth_date: "",
  password: "",
};

const form = useForm({ ...initialFormData });
const isEditing = computed(() => props.user !== null);

watch(
  () => [props.open, props.user],
  () => {
    form.defaults({
      first_name: props.user?.first_name || "",
      last_name: props.user?.last_name || "",
      username: props.user?.username || "",
      email: props.user?.email || "",
      bio: props.user?.bio || "",
      birth_date: props.user?.birth_date || "",
      password: "",
    });
    form.reset();
    form.clearErrors();
  },
  { immediate: true },
);

function submit() {
  const options = {
    preserveScroll: true,
    onSuccess: () => {
      emit("update:open", false);
      emit("saved");
    },
  };

  if (isEditing.value) {
    form.put(`/users/${props.user.id}`, options);
    return;
  }

  form.post("/users", options);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]"
    >
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Edit user" : "Create user" }}</DialogTitle>
        <DialogDescription>
          {{
            isEditing
              ? "Update profile fields or set a new password."
              : "Create a chat account for the admin workspace."
          }}
        </DialogDescription>
      </DialogHeader>

      <form id="user-form" class="space-y-4" @submit.prevent="submit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label for="first_name">First name</Label>
            <Input id="first_name" v-model="form.first_name" />
            <p v-if="form.errors.first_name" class="text-sm text-destructive">
              {{ form.errors.first_name }}
            </p>
          </div>
          <div class="grid gap-2">
            <Label for="last_name">Last name</Label>
            <Input id="last_name" v-model="form.last_name" />
            <p v-if="form.errors.last_name" class="text-sm text-destructive">
              {{ form.errors.last_name }}
            </p>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="username">Username</Label>
          <Input id="username" v-model="form.username" />
          <p v-if="form.errors.username" class="text-sm text-destructive">
            {{ form.errors.username }}
          </p>
        </div>

        <div class="grid gap-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="form.email" type="email" />
          <p v-if="form.errors.email" class="text-sm text-destructive">
            {{ form.errors.email }}
          </p>
        </div>

        <div class="grid gap-2">
          <Label for="birth_date">Birth date</Label>
          <Input id="birth_date" v-model="form.birth_date" type="date" />
          <p v-if="form.errors.birth_date" class="text-sm text-destructive">
            {{ form.errors.birth_date }}
          </p>
        </div>

        <div class="grid gap-2">
          <Label for="bio">Bio</Label>
          <textarea
            id="bio"
            v-model="form.bio"
            class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
          <p v-if="form.errors.bio" class="text-sm text-destructive">
            {{ form.errors.bio }}
          </p>
        </div>

        <div class="grid gap-2">
          <Label for="password">{{
            isEditing ? "New password" : "Password"
          }}</Label>
          <Input
            id="password"
            v-model="form.password"
            type="password"
            :placeholder="
              isEditing ? 'Leave blank to keep current password' : ''
            "
          />
          <p v-if="form.errors.password" class="text-sm text-destructive">
            {{ form.errors.password }}
          </p>
        </div>

        <p v-if="form.errors.user" class="text-sm text-destructive">
          {{ form.errors.user }}
        </p>
      </form>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
          >Cancel</Button
        >
        <Button type="submit" form="user-form" :disabled="form.processing">
          {{ isEditing ? "Save changes" : "Create user" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
