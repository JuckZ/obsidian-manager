import { App, Modal, Setting } from "obsidian";

export class InsertLinkModal extends Modal {
  linkText: string;
  linkUrl: string;

  onSubmit: (linkText: string, linkUrl: string) => void;

  constructor(
    app: App,
    defaultLinkText: string,
    onSubmit: (linkText: string, linkUrl: string) => void
  ) {
    super(app);
    this.linkText = defaultLinkText;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h1", { text: "Insert link" });

    new Setting(contentEl).setName("Link text").addText((text) =>
      text.setValue(this.linkText).onChange((value) => {
        this.linkText = value;
      })
    );

    new Setting(contentEl).setName("Link URL").addText((text) =>
      text.setValue(this.linkUrl).onChange((value) => {
        this.linkUrl = value;
      })
    );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Insert")
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.linkText, this.linkUrl);
        })
    );
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
