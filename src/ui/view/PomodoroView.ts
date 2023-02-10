import { HoverPopover, ItemView, WorkspaceLeaf } from 'obsidian';
import { App as VueApp, createApp } from 'vue';
import type ObsidianManagerPlugin from 'main';
import Title from '../Title';

export const POMODORO_VIEW = 'pomodoro-view';

export class PomodoroView extends ItemView {
    vueapp: VueApp;
    plugin: ObsidianManagerPlugin;
    hoverPopover: HoverPopover | null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianManagerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return POMODORO_VIEW;
    }

    getDisplayText(): string {
        return 'Pomodoro View';
    }

    getIcon(): string {
        return 'clock';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('div', {
            attr: {
                id: 'a-obsidian-manager-pomodoro-view',
            },
        });
        this.vueapp = createApp(Title, { plugin: this.plugin });
        this.vueapp.mount('#a-obsidian-manager-pomodoro-view');
    }

    async onClose() {
        this.vueapp.unmount();
    }
}
