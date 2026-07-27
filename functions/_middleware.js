// Cloudflare Pages Functions 使用的 sha256 实现
// 注意：Cloudflare Pages Functions 运行在 Workers 环境中，不能直接导入前端 JS 文件
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  try {
    const { request, env, next } = context;
    const response = await next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return response;
    }

    let html = await response.text();

    const password = env.HIDDENKEY || '';
    let passwordHash = '';
    if (password) {
      passwordHash = await sha256(password);
    }
    html = html.replace('window.__ENV__.HIDDENKEY = "{{HIDDENKEY}}";',
      `window.__ENV__.HIDDENKEY = "${passwordHash}";`);

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
    try {
      const { next } = context;
      return await next();
    } catch {
      return new Response('Service temporarily unavailable', { status: 503 });
    }
  }
}
