import { sha256 } from '../js/auth/sha256.js';

export async function onRequest(context) {
  try {
    const { request, env, next } = context;
    const response = await next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return response;
    }

    let html = await response.text();

    // 处理普通密码
    const password = env.PASSWORD || '';
    let passwordHash = '';
    if (password) {
      passwordHash = await sha256(password);
    }
    html = html.replace('window.__ENV__.PASSWORD = "{{PASSWORD}}";',
      `window.__ENV__.PASSWORD = "${passwordHash}";`);

    // 处理管理员密码
    const adminPassword = env.ADMINPASSWORD || '';
    let adminPasswordHash = '';
    if (adminPassword) {
      adminPasswordHash = await sha256(adminPassword);
    }
    html = html.replace('window.__ENV__.ADMINPASSWORD = "{{ADMINPASSWORD}}";',
      `window.__ENV__.ADMINPASSWORD = "${adminPasswordHash}";`);

    // 注入 TMDB Worker URL
    const tmdbWorkerUrl = env.TMDB_WORKER_URL || '';
    html = html.replace('window.__ENV__.TMDB_WORKER_URL = "{{TMDB_WORKER_URL}}";',
      `window.__ENV__.TMDB_WORKER_URL = "${tmdbWorkerUrl}";`);

    return new Response(html, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    console.error('[Middleware Error]', error);
    // 即使是内部错误，也返回一个正常的响应而非崩溃
    try {
      const { next } = context;
      return await next();
    } catch {
      return new Response('Service temporarily unavailable', { status: 503 });
    }
  }
}