<template>
  <div
    class="result-card group bg-[rgba(26,26,30,0.6)] rounded-xl overflow-hidden border border-[var(--color-border-default)] hover:border-pink-500/40 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-pink-500/5"
    @click="play"
  >
    <!-- 封面图 -->
    <div class="aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
      <img
        :src="coverUrl"
        :alt="title"
        class="w-full h-full object-cover transition-all duration-300 group-hover:scale-110 group-hover:brightness-110"
        loading="lazy"
        @error="onImageError"
      >
    </div>
    <!-- 信息区域 -->
    <div class="p-3 space-y-1">
      <h3 class="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{{ title }}</h3>
      <div class="flex items-center gap-1.5">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-pink-500/60 flex-shrink-0"></span>
        <p class="text-xs text-gray-500 truncate">{{ sourceName }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SearchResultCard.vue — 搜索结果卡片
 */

import { computed, ref } from 'vue';

const props = defineProps<{
  item: Record<string, any>;
}>();

const emit = defineEmits<{
  play: [item: Record<string, any>];
}>();

const imgError = ref(false);

const title = computed(() => String(props.item.vod_name || '未知'));
const sourceName = computed(() => String(props.item.source_name || ''));
const coverUrl = computed(() => {
  if (imgError.value) return '/image/nomedia.png';
  return props.item.vod_pic || '/image/nomedia.png';
});

function onImageError(): void {
  imgError.value = true;
}

function play(): void {
  emit('play', props.item);
}
</script>
