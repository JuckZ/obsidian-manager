import { App, Modal, SuggestModal, FuzzySuggestModal, Setting, Notice } from 'obsidian';

interface Book {
    title: string;
    author: string;
}

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

export class Example1Modal extends FuzzySuggestModal<Book> {
    getItems(): Book[] {
      return ALL_BOOKS;
    }
  
    getItemText(book: Book): string {
      return book.title;
    }
  
    onChooseItem(book: Book, evt: MouseEvent | KeyboardEvent) {
      new Notice(`Selected ${book.title}`);
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
        let { contentEl } = this;
        contentEl.empty();
    }
}
