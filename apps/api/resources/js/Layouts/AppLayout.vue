<script setup>
import AppSidebar from "@/components/AppSidebar.vue";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header
        class="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:px-6"
      >
        <SidebarTrigger class="md:hidden" />
      </header>

      <main class="p-4 md:p-8">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
