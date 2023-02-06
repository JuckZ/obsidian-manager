import type ObsidianManagerPlugin from 'main';
import { App, FuzzySuggestModal, Modal, Notice, Setting, SuggestModal, TAbstractFile } from 'obsidian';

interface Book {
    title: string;
    author: string;
}

interface ImageOrigin {
    title: string;
    origin: string;
}

const ALL_IMAGE_ORIGIN = [
    { title: 'pixabay', origin: 'pixabay' },
    { title: 'pexels', origin: 'pexels' },
    { title: 'dummyimage', origin: 'dummyimage' },
    // { title: 'deepai', origin: 'deepai' },
    // { title: 'random', origin: 'random' },
    // { title: 'localmatch', origin: 'localmatch' },
    // { title: 'templater', origin: 'templater' },
    // { title: 'input', origin: 'input' },
];

const ALL_BOOKS = [
    {
        title: 'How to Take Smart Notes',
        author: 'Sönke Ahrens',
    },
    {
        title: 'Thinking, Fast and Slow',
        author: 'Daniel Kahneman',
    },
    {
        title: 'Deep Work',
        author: 'Cal Newport',
    },
];

export class ImageOriginModal extends FuzzySuggestModal<ImageOrigin> {
    selectedPath: TAbstractFile | null;
    plugin: ObsidianManagerPlugin;

    constructor(app: App, plugin: ObsidianManagerPlugin, path: TAbstractFile | null) {
        super(app);
        this.plugin = plugin;
        this.selectedPath = path;
    }

    getItems(): ImageOrigin[] {
        return ALL_IMAGE_ORIGIN;
    }

    getItemText(imageOrigin: ImageOrigin): string {
        return imageOrigin.title;
    }

    onChooseItem(imageOrigin: ImageOrigin, evt: MouseEvent | KeyboardEvent) {
        new Notice(`Selected ${imageOrigin.origin}`);
        this.plugin.setRandomBanner(this.selectedPath, imageOrigin.origin);
    }
}

export class Example2Modal extends SuggestModal<Book> {
    // Returns all available suggestions.
    getSuggestions(query: string): Book[] {
        return ALL_BOOKS.filter(book => book.title.toLowerCase().includes(query.toLowerCase()));
    }

    // Renders each suggestion item.
    renderSuggestion(book: Book, el: HTMLElement) {
        el.createEl('div', { text: book.title });
        el.createEl('small', { text: book.author });
    }

    // Perform action on the selected suggestion.
    onChooseSuggestion(book: Book, evt: MouseEvent | KeyboardEvent) {
        new Notice(`Selected ${book.title}`);
    }
}
export class InsertLinkModal extends Modal {
    linkText: string;
    linkUrl: string;

    onSubmit: (linkText: string, linkUrl: string) => void;

    constructor(app: App, defaultLinkText: string, onSubmit: (linkText: string, linkUrl: string) => void) {
        super(app);
        this.linkText = defaultLinkText;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h1', { text: 'Insert link' });

        new Setting(contentEl).setName('Link text').addText(text =>
            text.setValue(this.linkText).onChange(value => {
                this.linkText = value;
            }),
        );

        new Setting(contentEl).setName('Link URL').addText(text =>
            text.setValue(this.linkUrl).onChange(value => {
                this.linkUrl = value;
            }),
        );

        new Setting(contentEl).addButton(btn =>
            btn
                .setButtonText('Insert')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.linkText, this.linkUrl);
                }),
        );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
