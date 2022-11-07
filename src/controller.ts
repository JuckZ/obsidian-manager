import {
  MarkdownView,
  TAbstractFile,
  TFile,
  Vault,
  WorkspaceLeaf,
} from "obsidian";

import { Content } from "model/content";
import type { Reminders, Reminder } from "model/reminder";


export class RemindersController {

  constructor(private vault: Vault, private reminders: Reminders) { }

  async reloadAllFiles() {
    console.debug("Reload all files and collect reminders");
    this.reminders.clear();
    for (const file of this.vault.getMarkdownFiles()) {
      await this.reloadFile(file, false);
    }
  }

  async reloadFile(file: TAbstractFile, reloadUI: boolean = false) {
    console.debug(
      "Reload file and collect reminders: file=%s, forceReloadUI=%s",
      file.path,
      reloadUI
    );
    if (!(file instanceof TFile)) {
      console.debug("Cannot read file other than TFile: file=%o", file);
      return false;
    }
    if (!this.isMarkdownFile(file)) {
      console.debug("Not a markdown file: file=%o", file);
      return false;
    }
    const content = new Content(file.path, await this.vault.cachedRead(file));
    const reminders = content.getReminders();
    if (reminders.length > 0) {
      if (!this.reminders.replaceFile(file.path, reminders)) {
        return false;
      }
    } else {
      if (!this.reminders.removeFile(file.path)) {
        return false;
      }
    }
    return true;
  }

  private isMarkdownFile(file: TFile) {
    return file.extension.toLowerCase() === "md";
  }
}
