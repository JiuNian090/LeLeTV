// PWA 注册 - 延迟到密码验证成功后
let deferredPrompt;

// 监听beforeinstallprompt事件
window.addEventListener('beforeinstallprompt', (e) => {
  // 阻止浏览器默认的安装提示
  e.preventDefault();
  // 保存事件，以便稍后触发
  deferredPrompt = e;
});

// 监听密码验证成功事件
document.addEventListener('passwordVerified', () => {
  // 密码验证成功后注册Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker 注册成功:', registration);
        })
        .catch(error => {
          console.log('Service Worker 注册失败:', error);
        });
    });
  }
  
  // 密码验证成功后显示PWA安装提示
  setTimeout(() => {
    showPWAInstallPrompt();
  }, 2000); // 延迟2秒显示提示
});

// 显示PWA安装提示
function showPWAInstallPrompt() {
  // 检查是否支持PWA安装
  if (deferredPrompt) {
    // 创建安装提示元素
    const installPrompt = document.createElement('div');
    installPrompt.id = 'pwa-install-prompt';
    installPrompt.className = 'fixed bottom-4 right-4 bg-[#111] border border-[#333] rounded-lg p-4 shadow-lg z-50 max-w-xs';
    installPrompt.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <img src="/image/logo-black.png" alt="LeLeTV" class="w-10 h-10 rounded-md">
        </div>
        <div class="ml-3 flex-1">
          <p class="text-white font-medium">安装 LeLeTV 应用</p>
          <p class="text-gray-400 text-sm mt-1">添加到桌面以获得更好的体验</p>
          <div class="mt-3 flex space-x-2">
            <button id="install-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">安装</button>
            <button id="dismiss-btn" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">稍后</button>
          </div>
        </div>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(installPrompt);
    
    // 添加事件监听
    document.getElementById('install-btn').addEventListener('click', () => {
      // 触发安装提示
      deferredPrompt.prompt();
      
      // 等待用户响应
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('用户接受了安装请求');
        } else {
          console.log('用户拒绝了安装请求');
        }
        // 清除提示
        document.getElementById('pwa-install-prompt').remove();
        deferredPrompt = null;
      });
    });
    
    // 关闭按钮事件
    document.getElementById('dismiss-btn').addEventListener('click', () => {
      document.getElementById('pwa-install-prompt').remove();
    });
  }
}