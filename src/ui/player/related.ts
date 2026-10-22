/**
 * 播放页「相关推荐」板块。
 *
 * 数据由 player-entry 注入（services/related），本模块只负责渲染与交互，
 * 避免 ui 层直接依赖 services。板块放在右栏操作按钮下面；横屏限高、内部滚动，
 * 竖屏不限高，跟随整页往下翻。
 */

import { StorageService } from '../../core/storage';
import { currentVideoTitle } from './state';
import { buildPlayerBackUrl, navigateToPlayer } from './bridge';
import { escHtml } from './utils';

export interface RelatedCard {
  id: string;
  title: string;
  cover: string;
  sourceCode: string;
  typeName: string;
  year: string;
  remarks: string;
}

export interface RelatedQuery {
  title: string;
  sourceCode: string;
  vodId: string;
  type: string;
  year: string;
}

type RelatedLoader = (query: RelatedQuery) => Promise<RelatedCard[]>;

const REFRESH_DEBOUNCE_MS = 350;

let loader: RelatedLoader | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastKey = '';
let requestSeq = 0;
let rendered: RelatedCard[] = [];
let bound = false;

/** 由 player-entry 注入数据加载函数 */
export function initRelatedSection(fn: RelatedLoader): void {
  loader = fn;
}

/** 详情 / 类型变化后调用；同一上下文只请求一次 */
export function refreshRelatedSection(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(run, REFRESH_DEBOUNCE_MS);
}

function showStatus(section: HTMLElement, grid: HTMLElement, text: string): void {
  section.hidden = false;
  rendered = [];
  grid.innerHTML = '<p class="related-status">' + escHtml(text) + '</p>';
}

function cardHtml(item: RelatedCard, index: number): string {
  const title = escHtml(item.title);
  const firstChar = escHtml(item.title.slice(0, 1) || '·');
  const cover = item.cover
    ? '<img src="' + escHtml(item.cover) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
    : '';
  return '<article class="player-related-card" role="button" tabindex="0" data-index="' + index + '"'
    + ' aria-label="播放 ' + title + '">'
    + '<div class="player-related-poster"><span class="player-related-ph" aria-hidden="true">' + firstChar + '</span>' + cover + '</div>'
    + '<p class="player-related-name" title="' + title + '">' + title + '</p>'
    + '</article>';
}

/** 站内跳转必须用绝对路径：播放页自身的相对路径会再拼一层目录 */
function openRelatedVideo(item: RelatedCard): void {
  const params = new URLSearchParams();
  params.set('id', item.id);
  params.set('title', item.title);
  params.set('source', item.sourceCode);
  let playerUrl = '/src/pages/player/index.html?' + params.toString();
  const backUrl = buildPlayerBackUrl();
  if (backUrl) playerUrl += '&back=' + encodeURIComponent(backUrl);

  try {
    localStorage.removeItem('currentEpisodes');
    localStorage.removeItem('currentEpisodeIndex');
    localStorage.removeItem('currentVideoInfo');
    localStorage.setItem('currentVideoTitle', item.title);
    localStorage.setItem('currentSourceCode', item.sourceCode);
    localStorage.setItem('lastPlayTime', String(Date.now()));
  } catch (e) { /* localStorage 不可用时仍可带参数跳转 */ }

  navigateToPlayer(playerUrl);
}

function bindGrid(grid: HTMLElement): void {
  if (bound) return;
  bound = true;

  grid.addEventListener('click', event => {
    const card = (event.target as HTMLElement).closest('.player-related-card') as HTMLElement | null;
    if (!card) return;
    const index = parseInt(card.dataset.index || '', 10);
    const item = Number.isInteger(index) ? rendered[index] : undefined;
    if (item) openRelatedVideo(item);
  });

  grid.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = (event.target as HTMLElement).closest('.player-related-card') as HTMLElement | null;
    if (!card) return;
    event.preventDefault();
    card.click();
  });
}

function readQuery(): RelatedQuery {
  const params = new URLSearchParams(window.location.search);
  const title = currentVideoTitle || params.get('title') || '';
  let type = '';
  let year = '';
  try {
    const info = StorageService.getCurrentVideoInfo();
    // 直链播放时 localStorage 里可能还留着上一部片的详情，标题对不上就不要拿来推荐
    const infoTitle = info && typeof info.title === 'string' ? info.title : '';
    if (info && (!infoTitle || infoTitle === title)) {
      if (typeof info.type === 'string') type = info.type;
      if (typeof info.year === 'string') year = info.year;
    }
  } catch (e) { /* 没有详情时只按片名推荐 */ }
  return {
    title,
    sourceCode: params.get('source') || '',
    vodId: params.get('id') || '',
    type,
    year
  };
}

function run(): void {
  timer = null;
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');
  if (!section || !grid) return;
  if (!loader) return;

  const query = readQuery();
  const key = [query.title, query.sourceCode, query.vodId, query.type].join('|');
  if (key === lastKey) return;
  lastKey = key;

  if (!query.sourceCode || !query.title) {
    showStatus(section, grid, '暂无可用的同源推荐');
    return;
  }

  const seq = ++requestSeq;
  showStatus(section, grid, '正在加载相关推荐…');

  loader(query).then(items => {
    if (seq !== requestSeq) return;
    if (!items.length) {
      showStatus(section, grid, '暂无相关推荐');
      return;
    }
    rendered = items;
    grid.innerHTML = items.map(cardHtml).join('');
    grid.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => img.remove(), { once: true });
    });
    bindGrid(grid);
    section.hidden = false;
    section.classList.add('is-ready');
  }).catch(() => {
    if (seq !== requestSeq) return;
    lastKey = '';
    showStatus(section, grid, '暂无相关推荐');
  });
}
