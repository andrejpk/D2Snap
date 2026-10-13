<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";
import type { RequestRecord } from "../records";

const props = defineProps<{ record: RequestRecord }>();
const emit = defineEmits<{
  view: [record: RequestRecord];
  reassign: [record: RequestRecord];
}>();
const menu = ref<InstanceType<typeof Menu> | null>(null);
const expanded = ref(false);
const items: MenuItem[] = [
  { label: "View request", command: () => emit("view", props.record) },
  { label: "Reassign owner", command: () => emit("reassign", props.record) },
];
</script>

<template>
  <Button
    class="row-action-button"
    :aria-label="`Actions for ${record.id}`"
    aria-haspopup="menu"
    :aria-expanded="expanded"
    :aria-controls="`request-actions-${record.id}`"
    @click="menu?.toggle($event)"
  ><span aria-hidden="true">⋯</span></Button>
  <Menu
    :id="`request-actions-${record.id}`"
    ref="menu"
    :model="items"
    popup
    append-to="body"
    :aria-label="`Actions for ${record.id}`"
    :pt="{
      root: { class: 'row-menu' },
      transition: { css: false },
      list: { class: 'menu-list' },
      itemContent: { class: 'menu-item-content' },
      itemLink: { class: 'menu-item-link' },
    }"
    @show="expanded = true"
    @hide="expanded = false"
  />
</template>
