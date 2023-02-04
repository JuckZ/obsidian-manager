import { App, TFile, TFolder } from 'obsidian';
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

export const getAbstractFileAtPath = (app: App, path: string) => {
    return app.vault.getAbstractFileByPath(path);
};

export const getFolderFromPath = (app: App, path: string): TFolder | null => {
    if (!path) return null;
    const file = path.slice(-1) == '/' ? path.substring(0, path.length - 1) : path;
    const afile = getAbstractFileAtPath(app, file);
    if (!afile) return null;
    return afile instanceof TFolder ? afile : afile.parent;
};

export const getFolderPathFromString = (file: string) => getFolderFromPath(app, file)?.path;

export async function getAllFiles(folders, images): Promise<TFile[]> {
    const children = await app.fileManager.vault.fileMap[folders].children;
    for (let index = 0; index < children.length; index++) {
        const element = children[index];
        if (element.children && element.children.length != 0) {
            await getAllFiles(element.path, images);
        } else {
            images.push(element);
        }
    }
    return images;
}
