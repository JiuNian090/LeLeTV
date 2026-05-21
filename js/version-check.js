async function fetchVersion(url, errorMessage, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(errorMessage);
    }
    return await response.text();
}

function formatVersion(versionString) {
    if (!versionString) {
        return '未知版本';
    }

    const cleanedString = versionString.trim();

    if (window.versionUtils && typeof window.versionUtils.formatVersionToSemantic === 'function') {
        return window.versionUtils.formatVersionToSemantic(cleanedString);
    }

    if (cleanedString.startsWith('v')) return cleanedString;

    return `v${cleanedString}`;
}

async function getLatestVersionFromChangelog() {
    try {
        const response = await fetch('/VERSION.txt', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('获取版本文件失败');
        }
        const versionText = await response.text();
        const rawVersion = versionText.trim();
        if (rawVersion) {
            if (window.versionUtils && typeof window.versionUtils.formatVersionToSemantic === 'function') {
                return window.versionUtils.formatVersionToSemantic(rawVersion);
            }
            return formatVersion(rawVersion);
        }
        return null;
    } catch (error) {
        console.error('解析版本文件出错:', error);
        return null;
    }
}

function parseChangelogMarkdown(markdownContent) {
    const versionEntries = [];
    let currentEntry = null;

    const lines = markdownContent.split('\n');

    lines.forEach((line) => {
        if (line.startsWith('### ')) {
            if (currentEntry) {
                versionEntries.push(currentEntry);
            }

            currentEntry = { content: '', version: '' };

            const versionMatch = line.match(/### (v[\d\.]+) \(([\d\-:\s]+)\)/);
            if (versionMatch) {
                const versionNumber = versionMatch[1];
                const dateInfo = versionMatch[2];

                currentEntry.version = versionNumber;
                currentEntry.content += `<h4 class="text-lg font-semibold mb-2 text-blue-400">${versionNumber} (${dateInfo})</h4>`;
            } else if (line.includes('初始版本')) {
                currentEntry.version = '初始版本';
                currentEntry.content += `<h4 class="text-lg font-semibold mb-2 text-blue-400">初始版本</h4>`;
            }
        } else if (line.startsWith('- ') && currentEntry) {
            const tagMatch = line.match(/- \[(.*?)\] (.*?)$/);
            if (tagMatch) {
                currentEntry.content += `<p class="ml-4 mb-1"><span class="text-green-400">[${tagMatch[1]}]</span> ${tagMatch[2]}</p>`;
            } else {
                currentEntry.content += `<p class="ml-4 mb-1">${line.substring(2)}</p>`;
            }
        } else if (line.trim() !== '' && currentEntry) {
            currentEntry.content += `<p class="text-gray-400 text-sm mt-2 ml-4">${line}</p>`;
        }
    });

    if (currentEntry) {
        versionEntries.push(currentEntry);
    }

    return versionEntries;
}
