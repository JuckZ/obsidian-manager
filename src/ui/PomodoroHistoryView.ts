import { HoverPopover, ItemView, WorkspaceLeaf } from 'obsidian';
import { App as VueApp, createApp } from 'vue';
import { selectDB } from 'utils/db/db';
import type { Pomodoro } from 'schemas/spaces';
import type ObsidianManagerPlugin from 'main';
import { eventTypes } from 'types/types';
import HelloVue from './HelloVue.vue';

export const POMODORO_HISTORY_VIEW = 'pomodoro-history-view';

export class PomodoroHistoryView extends ItemView {
    vueapp: VueApp;
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
        return 'clock';
    }

    async onOpen(): Promise<void> {
        // window.addEventListener(eventTypes.pomodoroChange, this.setContent.bind(this));
        // this.setContent();

        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('div', {
            cls: 'my-plugin-view',
            attr: {
                id: 'test1',
            },
        });
        this.vueapp = createApp(HelloVue);
        this.vueapp.mount('.my-plugin-view');
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
        this.vueapp.unmount();
    }
}
