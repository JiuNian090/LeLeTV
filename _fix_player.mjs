import fs from 'fs';

// Fix player.js
let src = fs.readFileSync('js/player/player.js', 'utf8');

// 1. Remove the password gate loading block (lines 157-167)
src = src.replace(/        const loadingEl = document\.getElementById\('player-loading'\);\n        if \(loadingEl\) \{\n            loadingEl\.style\.display = 'flex';\n            loadingEl\.innerHTML = `[\s\S]*?\n        \}\n        return;\n    \}/, '}');

// 2. Remove the passwordVerified event handler (lines 173-192)
const pwdHandler = `document.addEventListener('passwordVerified', () => {
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl) {
        loadingEl.innerHTML = \`
            <div class="loading-spinner">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
                    <circle cx="16" cy="2" r="3" fill="#ec4899" class="orbit-dot">
                        <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="0.8s" repeatCount="indefinite"/>
                    </circle>
                </svg>
            </div>
            <div class="loading-text">正在加载视频...</div>
        `;
        loadingEl.style.display = 'flex';
    }
    initializePageContent();
});
`;
src = src.replace(pwdHandler, '');

// Actually the template literal approach won't work. Let me use line-based removal.
console.log('First pass done, checking file...');
console.log('player-loading count:', (src.match(/player-loading/g) || []).length);
fs.writeFileSync('js/player/player.js', src);
