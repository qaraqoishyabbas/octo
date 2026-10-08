<script setup>
import { Head } from "@inertiajs/vue3";
import {
  Activity,
  CreditCard,
  Download,
  MessageSquare,
  PackageCheck,
  Radio,
  Users,
} from "@lucide/vue";
import AppLayout from "@/Layouts/AppLayout.vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const props = defineProps({
  metrics: {
    type: Array,
    default: () => [],
  },
  messageSeries: {
    type: Array,
    default: () => [],
  },
  pipeline: {
    type: Array,
    default: () => [],
  },
  recentUsers: {
    type: Array,
    default: () => [],
  },
  recentMessages: {
    type: Array,
    default: () => [],
  },
});

const icons = {
  users: Users,
  dialogs: MessageSquare,
  messages: CreditCard,
  activity: Activity,
  direct: MessageSquare,
  group: PackageCheck,
  channel: Radio,
};

function iconFor(name) {
  return icons[name] || Activity;
}

function barHeight(value) {
  const max = Math.max(...props.messageSeries.map((item) => item.value), 1);

  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}
</script>

<template>
  <Head title="Dashboard" />

  <AppLayout>
    <div class="flex flex-col gap-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 class="text-3xl font-semibold tracking-normal">Dashboard</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Chat administration overview, activity, and moderation signals.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="outline">Jan 20 - Feb 09</Button>
          <Button>
            <Download class="size-4" />
            Download
          </Button>
        </div>
      </div>

      <Tabs default-value="overview" class="space-y-6">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics" disabled>Analytics</TabsTrigger>
            <TabsTrigger value="reports" disabled>Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" class="space-y-6">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card v-for="metric in metrics" :key="metric.label">
              <CardHeader
                class="flex flex-row items-center justify-between space-y-0 pb-2"
              >
                <CardTitle class="text-sm font-medium">{{
                  metric.label
                }}</CardTitle>
                <component
                  :is="iconFor(metric.icon)"
                  class="size-4 text-muted-foreground"
                />
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">{{ metric.value }}</div>
                <p class="text-xs text-muted-foreground">{{ metric.change }}</p>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-4 xl:grid-cols-12">
            <Card class="xl:col-span-8">
              <CardHeader>
                <CardTitle>Message activity</CardTitle>
                <CardDescription
                  >Messages created during the last 12 months.</CardDescription
                >
              </CardHeader>
              <CardContent>
                <div class="flex h-72 items-end gap-3">
                  <div
                    v-for="item in messageSeries"
                    :key="item.label"
                    class="flex-1 rounded-t-md bg-primary"
                    :title="`${item.label}: ${item.value}`"
                    :style="{ height: barHeight(item.value) }"
                  />
                </div>
              </CardContent>
            </Card>

            <Card class="xl:col-span-4">
              <CardHeader>
                <CardTitle>Dialog mix</CardTitle>
                <CardDescription
                  >Current chat surface distribution.</CardDescription
                >
              </CardHeader>
              <CardContent class="space-y-4">
                <div
                  v-for="item in pipeline"
                  :key="item.label"
                  class="flex items-center justify-between rounded-lg border p-4"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="grid size-9 place-items-center rounded-md bg-muted"
                    >
                      <component
                        :is="iconFor(item.icon)"
                        class="size-4 text-muted-foreground"
                      />
                    </div>
                    <span class="text-sm font-medium">{{ item.label }}</span>
                  </div>
                  <span class="text-lg font-semibold">{{ item.value }}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-4 xl:grid-cols-12">
            <Card class="xl:col-span-7">
              <CardHeader>
                <CardTitle>Recent messages</CardTitle>
                <CardDescription
                  >Latest chat messages across dialogs.</CardDescription
                >
              </CardHeader>
              <CardContent class="space-y-4">
                <div
                  v-for="message in recentMessages"
                  :key="message.id"
                  class="rounded-lg border p-4"
                >
                  <div class="flex items-center justify-between gap-4">
                    <p class="text-sm font-medium">{{ message.sender }}</p>
                    <p class="text-xs text-muted-foreground">
                      {{ message.created_at }}
                    </p>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ message.dialog }}
                  </p>
                  <p class="mt-3 text-sm leading-6">{{ message.message }}</p>
                </div>
                <p
                  v-if="recentMessages.length === 0"
                  class="text-sm text-muted-foreground"
                >
                  No messages yet.
                </p>
              </CardContent>
            </Card>

            <Card class="xl:col-span-5">
              <CardHeader>
                <CardTitle>Recent users</CardTitle>
                <CardDescription>Newest accounts in the chat.</CardDescription>
              </CardHeader>
              <CardContent class="space-y-5">
                <div
                  v-for="user in recentUsers"
                  :key="user.id"
                  class="flex items-center"
                >
                  <Avatar class="size-9">
                    <AvatarFallback>{{ user.name.charAt(0) }}</AvatarFallback>
                  </Avatar>
                  <div class="ml-4 min-w-0">
                    <p class="truncate text-sm font-medium leading-none">
                      {{ user.name }}
                    </p>
                    <p class="mt-1 truncate text-sm text-muted-foreground">
                      {{ user.email }}
                    </p>
                  </div>
                  <div class="ml-auto text-xs text-muted-foreground">
                    {{ user.created_at }}
                  </div>
                </div>
                <p
                  v-if="recentUsers.length === 0"
                  class="text-sm text-muted-foreground"
                >
                  No users yet.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </AppLayout>
</template>
