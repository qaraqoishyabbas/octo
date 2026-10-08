<script setup lang="ts">
import type { LucideIcon } from "@lucide/vue";
import { computed } from "vue";
import {
  ChevronRight,
  BellRing,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
  Users,
} from "@lucide/vue";
import { Link, usePage } from "@inertiajs/vue3";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
};

const page = usePage();

function isActive(url: string) {
  return page.url === url || page.url.startsWith(`${url}?`);
}

const items = computed<NavItem[]>(() => [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: isActive("/dashboard") || page.url === "/",
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
    isActive: isActive("/users"),
  },
  {
    title: "Channels",
    url: "/channels",
    icon: Radio,
    isActive: isActive("/channels"),
  },
  {
    title: "Groups",
    url: "/groups",
    icon: MessageSquare,
    isActive: isActive("/groups"),
  },
  {
    title: "Уведомления",
    url: "/notification-apps",
    icon: BellRing,
    isActive: isActive("/notification-apps"),
  },
]);
</script>

<template>
  <SidebarGroup>
    <SidebarMenu class="gap-0">
      <SidebarMenuItem v-for="item in items" :key="item.title">
        <Collapsible
          v-if="item.items?.length"
          :default-open="item.isActive"
          class="group/collapsible"
        >
          <CollapsibleTrigger as-child>
            <SidebarMenuButton :is-active="item.isActive" :tooltip="item.title">
              <component :is="item.icon" v-if="item.icon" />
              <span>{{ item.title }}</span>
              <ChevronRight
                class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem
                v-for="subItem in item.items"
                :key="subItem.title"
              >
                <SidebarMenuSubButton as-child>
                  <a :href="subItem.url">
                    <span>{{ subItem.title }}</span>
                  </a>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>

        <SidebarMenuButton
          v-else
          as-child
          :is-active="item.isActive"
          :tooltip="item.title"
        >
          <Link :href="item.url">
            <component :is="item.icon" v-if="item.icon" />
            <span>{{ item.title }}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
