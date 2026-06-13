<template>
  <div class="category-page-layout">
    <div class="category-content-container">
      <!-- 筛选区域 -->
      <div class="mt-4">
        <div class="tmdb-filter-section">
          <!-- 类型切换 -->
          <div class="tmdb-filter-row">
            <div class="tmdb-type-switch">
              <button v-for="t in types" :key="t.value" :class="['tmdb-type-btn tmdb-genre-btn', { active: state.type === t.value }]" @click="switchType(t.value)">{{ t.label }}</button>
            </div>
          </div>

          <!-- 类型筛选（展开/折叠） -->
          <div class="tmdb-filter-row tmdb-genre-row">
            <div :class="['tmdb-genre-list', { 'genre-filter-collapsed': !genreExpanded && genres.length > 8 }]">
              <button :class="['tmdb-genre-btn', { active: !state.selectedGenre }]" @click="setGenre(null)">全部</button>
              <button v-for="(g, i) in genres" :key="g.id" :class="['tmdb-genre-btn', { active: state.selectedGenre === g.id }, { 'genre-btn-extra': i >= 8 }]" @click="setGenre(g.id)">{{ g.name }}</button>
              <button v-if="genres.length > 8" class="tmdb-genre-btn genre-toggle-btn" @click="genreExpanded = !genreExpanded">{{ genreExpanded ? '收起' : '更多类型...' }}</button>
            </div>
          </div>

          <!-- 地区 -->
          <div class="tmdb-filter-row tmdb-genre-row">
            <div class="tmdb-genre-list">
              <button v-for="c in countries" :key="c.value" :class="['tmdb-genre-btn', { active: state.originCountry === c.value }]" @click="setCountry(c.value)">{{ c.label }}</button>
            </div>
          </div>

          <!-- TV 状态（仅电视剧/动漫/综艺） -->
          <div v-if="!isMovie" class="tmdb-filter-row tmdb-genre-row">
            <div class="tmdb-genre-list">
              <button v-for="s in tvStatuses" :key="s.value" :class="['tmdb-genre-btn', { active: state.tvStatus === s.value }]" @click="setTvStatus(s.value)">{{ s.label }}</button>
            </div>
          </div>

          <!-- 语言 -->
          <div class="tmdb-filter-row tmdb-genre-row">
            <div class="tmdb-genre-list">
              <button v-for="l in languages" :key="l.value" :class="['tmdb-genre-btn', { active: state.originalLanguage === l.value }]" @click="setLanguage(l.value)">{{ l.label }}</button>
            </div>
          </div>

          <!-- 年份 -->
          <div class="tmdb-filter-row tmdb-genre-row">
            <div :class="['tmdb-genre-list year-filter-list', { 'year-filter-collapsed': !yearExpanded && years.length > 7 }]">
              <button v-for="(y, i) in years" :key="y.value" :class="['tmdb-genre-btn', { active: state.selectedYear === y.value }, { 'year-btn-extra': i >= 7 }]" @click="setYear(y.value)">{{ y.label }}</button>
              <button v-if="years.length > 7" class="tmdb-genre-btn year-toggle-btn" @click="yearExpanded = !yearExpanded">{{ yearExpanded ? '收起' : '更多年份...' }}</button>
            </div>
          </div>

          <!-- 评分 -->
          <div class="tmdb-filter-row tmdb-genre-row">
            <div class="tmdb-genre-list">
              <button :class="['tmdb-genre-btn', { active: state.voteRating === '' }]" @click="setRating('')">全部评分</button>
              <button v-for="r in ['9','8','7','6','5']" :key="r" :class="['tmdb-genre-btn', { active: state.voteRating === r }]" @click="setRating(r)">{{ r }}分以上</button>
            </div>
          </div>

          <!-- 排序 -->
          <div class="tmdb-filter-row tmdb-genre-row">
            <div class="tmdb-genre-list">
              <button v-for="s in sortOptions" :key="s.value" :class="['tmdb-genre-btn', { active: state.selectedSort === s.value }]" @click="setSort(s.value)">{{ s.label }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 结果区域 -->
      <div class="tmdb-results-grid mt-6">
        <!-- 加载中 -->
        <div v-if="isLoading" class="tmdb-loading col-span-full">
          <div class="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-gray-400 ml-3">加载中...</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="results.length === 0" class="col-span-full text-center py-12">
          <div class="text-gray-400 text-lg">没有找到相关内容</div>
          <div class="text-gray-500 text-sm mt-2">请尝试调整筛选条件</div>
        </div>

        <!-- 结果卡片 -->
        <div v-else v-for="item in results" :key="item.id" class="tmdb-card" @click="searchVideo(item)">
          <div class="tmdb-card-inner">
            <div class="tmdb-card-poster">
              <template v-if="item.poster_path">
                <img :src="`${imageBase}${posterSize}${item.poster_path}`" :alt="itemTitle(item)" loading="lazy" class="tmdb-card-img" @error="imgError[item.id] = true">
                <div v-if="!imgError[item.id]" class="tmdb-card-rating">★ {{ voteAvg(item) }}</div>
                <div v-if="!imgError[item.id] && genreNames(item).length" class="tmdb-card-genres">
                  <span v-for="g in genreNames(item).slice(0, 2)" :key="g">{{ g }}</span>
                </div>
              </template>
              <div v-else class="tmdb-card-placeholder">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <span class="text-xs text-gray-500 mt-2">{{ itemTitle(item) }}</span>
              </div>
            </div>
            <div class="tmdb-card-body">
              <div class="tmdb-card-meta">
                <span class="tmdb-card-year">{{ itemYear(item) }}</span>
                <span v-if="item.vote_count" class="tmdb-card-votes">{{ item.vote_count }} 票</span>
              </div>
              <div class="tmdb-card-title" :title="itemTitle(item)">{{ itemTitle(item) }}</div>
              <div class="tmdb-card-overview">{{ item.overview || '暂无简介' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="mt-6">
        <div v-if="totalPages > 1" class="tmdb-pagination">
          <button :class="['tmdb-page-btn', { disabled: page <= 1 }]" :disabled="page <= 1" @click="goToPage(page - 1)">上一页</button>
          <template v-for="p in pageRange" :key="p">
            <button v-if="typeof p === 'number'" :class="['tmdb-page-btn', { active: p === page }]" @click="goToPage(p)">{{ p }}</button>
            <span v-else class="tmdb-page-ellipsis">{{ p }}</span>
          </template>
          <button :class="['tmdb-page-btn', { disabled: page >= totalPages }]" :disabled="page >= totalPages" @click="goToPage(page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TmdbCategory.vue — TMDB 分类浏览
 *
 * 复用 TMDB_STATE 和 TMDB 服务层，用 Vue 渲染筛选栏、卡片和分页。
 */

import { ref, computed, onMounted, reactive } from 'vue';
import {
  TMDB_STATE,
  TMDB_CONFIG,
  GENRE_MAP,
  SORT_OPTIONS,
  fetchTmdbDiscover,
} from '../../services/api/tmdb';

// ===== 常量 =====

const state = TMDB_STATE as any;

const types = [
  { value: 'movie', label: '电影' },
  { value: 'tv', label: '电视剧' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
];

const languages = [
  { value: '', label: '全部语言' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'th', label: '泰语' },
  { value: 'hi', label: '印地语' },
  { value: 'ru', label: '俄语' },
];

const countries = [
  { value: '', label: '全部地区' },
  { value: 'CN', label: '中国大陆' },
  { value: 'US', label: '美国' },
  { value: 'JP', label: '日本' },
  { value: 'KR', label: '韩国' },
  { value: 'GB', label: '英国' },
  { value: 'FR', label: '法国' },
  { value: 'DE', label: '德国' },
  { value: 'HK', label: '香港' },
  { value: 'TW', label: '台湾' },
  { value: 'IN', label: '印度' },
  { value: 'TH', label: '泰国' },
];

const tvStatuses = [
  { value: '', label: '全部状态' },
  { value: '0', label: '已播完' },
  { value: '1', label: '拍摄中' },
  { value: '2', label: '计划中' },
  { value: '3', label: '即将开播' },
  { value: '4', label: '连载中' },
  { value: '5', label: '暂停播出' },
];

const imageBase = TMDB_CONFIG.imageBase;
const posterSize = TMDB_CONFIG.posterSize;

// ===== 状态 =====

const isLoading = ref(false);
const results = ref<any[]>([]);
const page = ref(1);
const totalPages = ref(1);
const genreExpanded = ref(false);
const yearExpanded = ref(false);
const imgError = reactive<Record<number, boolean>>({});

// ===== 计算属性 =====

const isMovie = computed(() => state.type === 'movie');

const genres = computed(() => {
  const type = state.type === 'anime' || state.type === 'variety' ? 'tv' : state.type;
  return GENRE_MAP[type] || [];
});

const sortOptions = computed(() => SORT_OPTIONS[state.type] || []);

const years = computed(() => {
  const current = new Date().getFullYear();
  const list = [{ value: '', label: '全部年份' }];
  for (let y = current; y >= 1990; y--) {
    list.push({ value: String(y), label: String(y) });
  }
  list.push({ value: '1980s', label: '1980年代' });
  list.push({ value: '1970s', label: '1970年代' });
  list.push({ value: '1960s', label: '更早' });
  return list;
});

const pageRange = computed(() => {
  const current = page.value;
  const total = totalPages.value;
  const delta = 2;
  const range: (number | string)[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }
  return range;
});

// ===== 生命周期 =====

onMounted(() => {
  if (!state.isLoaded) {
    state.isLoaded = true;
    resetFilters();
    loadResults();
  }
});

// ===== 方法 =====

function resetFilters(): void {
  state.page = 1;
  state.selectedGenre = null;
  state.selectedYear = '';
  state.selectedSort = isMovie.value ? 'primary_release_date.desc' : 'first_air_date.desc';
  state.voteRating = '';
  state.originalLanguage = '';
  state.originCountry = '';
  state.tvStatus = '';

  if (state.type === 'anime') {
    state.selectedGenre = 16;
    state.originalLanguage = 'ja';
  } else if (state.type === 'variety') {
    state.selectedGenre = 10764;
  }
}

function switchType(type: string): void {
  if (type === state.type) return;
  state.type = type;
  resetFilters();
  loadResults();
}

function setGenre(id: number | null): void {
  state.selectedGenre = id;
  state.page = 1;
  loadResults();
}
function setCountry(v: string): void { state.originCountry = v; state.page = 1; loadResults(); }
function setTvStatus(v: string): void { state.tvStatus = v; state.page = 1; loadResults(); }
function setLanguage(v: string): void { state.originalLanguage = v; state.page = 1; loadResults(); }
function setYear(v: string): void { state.selectedYear = v; state.page = 1; loadResults(); }
function setRating(v: string): void { state.voteRating = v; state.page = 1; loadResults(); }
function setSort(v: string): void { state.selectedSort = v; state.page = 1; loadResults(); }

function goToPage(p: number): void {
  if (p < 1 || p > totalPages.value || p === page.value) return;
  state.page = p;
  page.value = p;
  loadResults();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadResults(): Promise<void> {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const data = await fetchTmdbDiscover();
    if (data) {
      results.value = data.results || [];
      totalPages.value = data.total_pages || 1;
      page.value = data.page || 1;
    } else {
      results.value = [];
    }
    imgError && Object.keys(imgError).forEach(k => { (imgError as any)[k] = false; });
  } catch {
    results.value = [];
  } finally {
    isLoading.value = false;
  }
}

function itemTitle(item: any): string {
  return isMovie.value ? item.title || item.name : item.name || item.title;
}
function itemYear(item: any): string {
  const d = isMovie.value ? item.release_date : item.first_air_date;
  return d ? d.split('-')[0] : '';
}
function voteAvg(item: any): string {
  return item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
}
function genreNames(item: any): string[] {
  const effectiveType = state.type === 'anime' || state.type === 'variety' ? 'tv' : state.type;
  return (GENRE_MAP[effectiveType] || [])
    .filter((g: any) => (item.genre_ids || []).includes(g.id))
    .map((g: any) => g.name);
}

function searchVideo(item: any): void {
  const title = itemTitle(item);
  const input = document.getElementById('searchInput') as HTMLInputElement;
  if (input) {
    input.value = title;
    const nativeSearch = (window as any).__nativeExecuteSearch;
    if (nativeSearch) nativeSearch(title);
  }
}
</script>
