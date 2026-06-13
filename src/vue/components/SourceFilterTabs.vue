<template>
  <div class="source-filter-tabs flex flex-wrap gap-2 mb-4">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :class="['source-filter-tab', { active: activeFilter === tab.key }]"
      @click="$emit('filter', tab.key)"
    >
      {{ tab.label }} ({{ tab.count }})
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * SourceFilterTabs.vue — 搜索结果源过滤标签
 */

import { computed } from 'vue';

const props = defineProps<{
  results: Record<string, any>[];
  activeFilter: string;
}>();

defineEmits<{
  filter: [key: string];
}>();

interface TabItem {
  key: string;
  label: string;
  count: number;
}

const tabs = computed<TabItem[]>(() => {
  const sourceMap = new Map<string, number>();
  props.results.forEach((r) => {
    const code = r.source_code || 'unknown';
    sourceMap.set(code, (sourceMap.get(code) || 0) + 1);
  });

  const result: TabItem[] = [
    { key: 'all', label: '全部', count: props.results.length },
  ];

  sourceMap.forEach((count, code) => {
    const name = props.results.find((r) => r.source_code === code)?.source_name || code;
    result.push({ key: code, label: name, count });
  });

  return result;
});
</script>
