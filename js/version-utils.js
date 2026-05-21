function convertToSemanticVersion(versionString) {
    if (!versionString || typeof versionString !== 'string') {
        return '未知版本';
    }

    const cleaned = versionString.trim();

    if (!cleaned) return '未知版本';

    if (cleaned.startsWith('v')) return cleaned;

    return `v${cleaned}`;
}

function formatVersionToSemantic(versionString) {
    return convertToSemanticVersion(versionString);
}

async function getLatestVersionFromChangelog() {
    try {
        const resp = await fetch('/VERSION.txt', { cache: 'no-store' });
        if (!resp.ok) throw new Error('获取版本文件失败');
        const text = await resp.text();
        const rawVersion = text.trim();
        if (!rawVersion) return '未知版本';
        return convertToSemanticVersion(rawVersion);
    } catch (error) {
        console.error('获取最新版本号出错:', error);
        return '未知版本';
    }
}

function updateFooterVersion() {
    getLatestVersionFromChangelog().then(latestVersion => {
        const versionElements = document.querySelectorAll('.footer p.text-gray-500.text-sm');

        let versionElement = null;
        versionElements.forEach(el => {
            if (el.textContent.includes('版本:')) {
                versionElement = el;
            }
        });

        if (versionElement) {
            versionElement.innerHTML = `版本: ${latestVersion}`;
        } else {
            versionElement = document.createElement('p');
            versionElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
            versionElement.innerHTML = `版本: ${latestVersion}`;

            const footerElement = document.querySelector('.footer p.text-gray-500.text-sm');
            if (footerElement) {
                footerElement.insertAdjacentElement('afterend', versionElement);
            } else if (document.querySelector('.footer .container')) {
                document.querySelector('.footer .container div').appendChild(versionElement);
            }
        }
    });
}

window.versionUtils = {
    convertToSemanticVersion,
    formatVersionToSemantic,
    getLatestVersionFromChangelog,
    updateFooterVersion
};
