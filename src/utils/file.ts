import * as obsidian from 'obsidian';

export async function getNotePath(directory, filename) {
    if (!filename.endsWith('.md')) {
        filename += '.md';
    }
    const path = obsidian.normalizePath(join(directory, filename));
    await ensureFolderExists(path);
    return path;
}

function join(...partSegments) {
    let parts = [];
    for (let i2 = 0, l2 = partSegments.length; i2 < l2; i2++) {
        parts = parts.concat(partSegments[i2].split('/'));
    }
    const newParts = [];
    for (let i2 = 0, l2 = parts.length; i2 < l2; i2++) {
        const part = parts[i2];
        if (!part || part === '.') continue;
        else newParts.push(part);
    }
    if (parts[0] === '') newParts.unshift();
    return newParts.join('/');
}

async function ensureFolderExists(path) {
    const dirs = path.replace(/\\/g, '/').split('/');
    dirs.pop();
    if (dirs.length) {
        const dir = join(...dirs);
        if (!window.app.vault.getAbstractFileByPath(dir)) {
            await window.app.vault.createFolder(dir);
        }
    }
}
