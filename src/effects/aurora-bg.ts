/**
 * Aurora 极光背景特效
 */

export interface AuroraOptions {
  selector: string;
  colorStops: string[];
  amplitude: number;
  blend: number;
  speed: number;
}

export function initAurora(options: AuroraOptions): void {
  const { selector, colorStops, amplitude, blend, speed } = options;
  const container = document.querySelector(selector) as HTMLElement;
  if (!container) return;

  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.zIndex = '-1';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  let animationId: number;
  let time = 0;

  function resize(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  function draw(): void {
    time += 0.005 * speed;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < colorStops.length; i++) {
      const color = colorStops[i];
      const offset = (i / colorStops.length) * Math.PI * 2;
      const cx = w / 2 + Math.sin(time * 0.3 + offset) * w * 0.2;
      const cy = h / 2 + Math.cos(time * 0.2 + offset) * h * 0.15;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * amplitude);
      gradient.addColorStop(0, color + '99');
      gradient.addColorStop(0.5, color + '40');
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = blend / colorStops.length;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.globalAlpha = 1;
    animationId = requestAnimationFrame(draw);
  }

  draw();
}
