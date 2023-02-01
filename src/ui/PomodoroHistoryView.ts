import { HoverPopover, ItemView, WorkspaceLeaf } from 'obsidian';
import { selectDB } from 'utils/db/db';
import type { Pomodoro } from 'schemas/spaces';
import type ObsidianManagerPlugin from 'main';
import { eventTypes } from 'types/types';

export const POMODORO_HISTORY_VIEW = 'pomodoro-history-view';

export class PomodoroHistoryView extends ItemView {
    plugin: ObsidianManagerPlugin;
    hoverPopover: HoverPopover | null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianManagerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return POMODORO_HISTORY_VIEW;
    }

    getDisplayText(): string {
        // TODO: Make this interactive: Either the active workspace or the local graph
        return 'Pomodoro History View';
    }

    getIcon(): string {
        return 'Pomodoro History View';
    }

    async onOpen(): Promise<void> {
        window.addEventListener(eventTypes.pomodoroChange, this.setContent.bind(this));
        this.setContent();
    }

    async setContent() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h4', { text: 'Pomodoro History View' });
        console.log(this.plugin.spaceDB);
        selectDB(this.plugin.spaceDB, 'pomodoro')?.rows.forEach((row: Pomodoro) => {
            container.createEl('li', { text: row.task });
        });
    }

    async onClose() {
        // Nothing to clean up.
    }
}
