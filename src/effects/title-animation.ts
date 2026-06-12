/**
 * LeLeTV 标题书写动效
 */

import { TIMING } from '../core/timing';

export function initTitleAnimation(containerId: string = 'titleContainer'): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const text = 'LeLeTV';
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.gap = '0';

  const chars: HTMLElement[] = [];

  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.textContent = text[i];
    span.style.opacity = '0';
    span.style.transform = 'translateY(20px)';
    span.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    span.style.display = 'inline-block';

    if (text[i] === 'L' || text[i] === 'T') {
      span.style.background = 'linear-gradient(135deg, #ec4899, #8b5cf6)';
      span.style.webkitBackgroundClip = 'text';
      span.style.webkitTextFillColor = 'transparent';
      span.style.backgroundClip = 'text';
      span.style.fontWeight = '800';
    } else {
      span.style.color = '#fff';
      span.style.fontWeight = '300';
    }

    span.style.fontSize = window.innerWidth <= 640 ? '2rem' : '2.5rem';
    span.style.letterSpacing = '0.05em';
    container.appendChild(span);
    chars.push(span);
  }

  chars.forEach((char, i) => {
    setTimeout(() => {
      char.style.opacity = '1';
      char.style.transform = 'translateY(0)';
    }, i * TIMING.TITLE_ANIMATION_NORMAL);
  });
}
