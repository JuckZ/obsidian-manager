import type { EditorPosition, PluginManifest, WorkspaceLeaf } from 'obsidian';
import { App, Editor, MarkdownView, Menu, Notice, Plugin, TFile, addIcon, setIcon } from 'obsidian';
import moment from 'moment';
import axios from 'axios';
import { getAllDailyNotes, getDailyNote, getDailyNoteSettings } from 'obsidian-daily-notes-interface';
import { RemindersController } from 'controller';
import { PluginDataIO } from 'data';
import { Reminder, Reminders } from 'model/reminder';
import { ReminderSettingTab, SETTINGS } from 'settings';
import { DATE_TIME_FORMATTER } from 'model/time';
import { monkeyPatchConsole } from 'obsidian-hack/obsidian-debug-mobile';
import { Example1Modal, Example2Modal, InsertLinkModal } from 'ui/modal/insert-link-modal';
import { ExampleView, VIEW_TYPE_EXAMPLE } from 'ui/ExampleView';
import { Emoji } from 'render/Emoji';
import { ReminderModal } from 'ui/reminder';
// import { AutoComplete } from 'ui/autocomplete';
import Logger from 'utils/logger';

import type { ReadOnlyReference } from 'model/ref';
interface PasteFunction {
    (this: HTMLElement, ev: ClipboardEvent): void;
}

class ExtApp extends App {
    internalPlugins: any;
    plugins: any;
    commands: any;
}

class ExtTFile extends TFile {
    override basename!: string;
}

class OneDay {
    file!: TFile;
    oldContent = '';

    constructor(protected fileVal: TFile, protected oldContentVal: string) {
        this.file = fileVal;
        this.oldContent = oldContentVal;
    }
}
class UndoHistoryInstance {
    previousDay!: OneDay;
    today!: OneDay;

    constructor(protected previousDayVal: OneDay, protected todayVal: OneDay) {
        this.previousDay = previousDayVal;
        this.today = todayVal;
    }
}

const MAX_TIME_SINCE_CREATION = 5000; // 5 seconds

export default class ObsidianManagerPlugin extends Plugin {
    override app: ExtApp;
    pluginDataIO: PluginDataIO;
    private undoHistory: any[];
    private undoHistoryTime: Date;
    private remindersController: RemindersController;
    private editDetector: EditDetector;
    private reminderModal: ReminderModal;
    // private autoComplete: AutoComplete;
    private reminders: Reminders;
    pasteFunction: (evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView) => any;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.app = app as ExtApp;
        this.reminders = new Reminders(() => {
            this.pluginDataIO.changed = true;
        });
        this.undoHistory = [];
        this.undoHistoryTime = new Date();
        this.pluginDataIO = new PluginDataIO(this, this.reminders);
        this.reminders.reminderTime = SETTINGS.reminderTime;
        DATE_TIME_FORMATTER.setTimeFormat(SETTINGS.dateFormat, SETTINGS.dateTimeFormat, SETTINGS.strictDateFormat);
        this.editDetector = new EditDetector(SETTINGS.editDetectionSec);
        this.remindersController = new RemindersController(app.vault, this.reminders);
        this.reminderModal = new ReminderModal(this.app, SETTINGS.useSystemNotification, SETTINGS.laters);
        // TODO 完善
        this.pasteFunction = this.customizePaste.bind(this);
        console.warn(this.reminderModal);
    }

    isDailyNotesEnabled() {
        const dailyNotesPlugin = this.app.internalPlugins.plugins['daily-notes'];
        const dailyNotesEnabled = dailyNotesPlugin && dailyNotesPlugin.enabled;
        const periodicNotesPlugin = this.app.plugins.getPlugin('periodic-notes');
        const periodicNotesEnabled = periodicNotesPlugin && periodicNotesPlugin.settings?.daily?.enabled;

        return dailyNotesEnabled || periodicNotesEnabled;
    }

    getLastDailyNote(): TFile {
        const { folder = '', format } = getDailyNoteSettings();

        // get all notes in directory that aren't null
        const dailyNoteFiles = this.app.vault
            .getAllLoadedFiles()
            .filter(file => file.path.startsWith(folder))
            .filter(file => (file as ExtTFile).basename != null) as TFile[];

        // remove notes that are from the future
        const todayMoment = moment();
        const dailyNotesTodayOrEarlier: TFile[] = [];
        dailyNoteFiles.forEach(file => {
            if (moment(file.basename, format).isSameOrBefore(todayMoment, 'day')) {
                dailyNotesTodayOrEarlier.push(file);
            }
        });

        // sort by date
        const sorted = dailyNotesTodayOrEarlier.sort(
            (a, b) => moment(b.basename, format).valueOf() - moment(a.basename, format).valueOf(),
        );
        return sorted[1] as TFile;
    }

    async getAllUnfinishedTodos(file: TFile) {
        const contents = await this.app.vault.read(file);
        const unfinishedTodosRegex = /\t*- \[ \].*/g;
        const unfinishedTodos = Array.from(contents.matchAll(unfinishedTodosRegex)).map(([todo]) => todo);

        return unfinishedTodos;
    }

    async sortHeadersIntoHeirarchy(file: TFile) {
        ///Logger.log('testing')
        const templateContents = await this.app.vault.read(file);
        const allHeadings = Array.from(templateContents.matchAll(/#{1,} .*/g)).map(([heading]) => heading);

        if (allHeadings.length > 0) {
            // Logger.log(createRepresentationFromHeadings(allHeadings));
        }
    }

    async sayHello() {
        await this.remindersController.reloadAllFiles();
        this.pluginDataIO.scanned.value = true;
        this.pluginDataIO.save();
        const expired = this.reminders.getExpiredReminders(SETTINGS.reminderTime.value);
    }

    async rollover(file: TFile | undefined) {
        /*** First we check if the file created is actually a valid daily note ***/
        const { folder = '', format } = getDailyNoteSettings();
        let ignoreCreationTime = false;

        // Rollover can be called, but we need to get the daily file
        if (file == undefined) {
            const allDailyNotes = getAllDailyNotes();
            file = getDailyNote(moment(), allDailyNotes);
            ignoreCreationTime = true;
        }
        if (!file) return;

        // is a daily note
        if (!file.path.startsWith(folder)) return;

        // is today's daily note
        const today = new Date();
        const todayFormatted = moment(today).format(format);
        if (todayFormatted !== file.basename) return;

        // was just created
        if (today.getTime() - file.stat.ctime > MAX_TIME_SINCE_CREATION && !ignoreCreationTime) return;

        /*** Next, if it is a valid daily note, but we don't have daily notes enabled, we must alert the user ***/
        if (!this.isDailyNotesEnabled()) {
            new Notice(
                'ObsidianManagerPlugin unable to rollover unfinished todos: Please enable Daily Notes, or Periodic Notes (with daily notes enabled).',
                10000,
            );
        } else {
            const { templateHeading, deleteOnComplete, removeEmptyTodos } = SETTINGS;
            // check if there is a daily note from yesterday
            const lastDailyNote = this.getLastDailyNote();
            if (lastDailyNote == null) return;

            // TODO: Rollover to subheadings (optional)
            //this.sortHeadersIntoHeirarchy(lastDailyNote)

            // get unfinished todos from yesterday, if exist
            const todos_yesterday = await this.getAllUnfinishedTodos(lastDailyNote);
            if (todos_yesterday.length == 0) {
                Logger.log(`rollover-daily-todos: 0 todos found in ${lastDailyNote.basename}.md`);
                return;
            }

            // Potentially filter todos from yesterday for today
            let todosAdded = 0;
            let emptiesToNotAddToTomorrow = 0;
            const todos_today = !removeEmptyTodos.value ? todos_yesterday : [];
            if (removeEmptyTodos.value) {
                todos_yesterday.forEach((line, i) => {
                    const trimmedLine = (line || '').trim();
                    if (trimmedLine != '- [ ]' && trimmedLine != '- [  ]') {
                        todos_today.push(line);
                        todosAdded++;
                    } else {
                        emptiesToNotAddToTomorrow++;
                    }
                });
            } else {
                todosAdded = todos_yesterday.length;
            }

            // get today's content and modify it
            let templateHeadingNotFoundMessage = '';
            const templateHeadingSelected = templateHeading.value !== 'none';
            let today!: OneDay;
            if (todos_today.length > 0) {
                let dailyNoteContent = await this.app.vault.read(file);
                today = new OneDay(file, `${dailyNoteContent}`);
                const todos_todayString = `\n${todos_today.join('\n')}`;

                // If template heading is selected, try to rollover to template heading
                if (templateHeadingSelected) {
                    const contentAddedToHeading = dailyNoteContent.replace(
                        templateHeading.value,
                        `${templateHeading.value}${todos_todayString}`,
                    );
                    if (contentAddedToHeading == dailyNoteContent) {
                        templateHeadingNotFoundMessage = `Rollover couldn't find '${templateHeading.value}' in today's daily not. Rolling todos to end of file.`;
                    } else {
                        dailyNoteContent = contentAddedToHeading;
                    }
                }

                // Rollover to bottom of file if no heading found in file, or no heading selected
                if (!templateHeadingSelected || templateHeadingNotFoundMessage.length > 0) {
                    dailyNoteContent += todos_todayString;
                }

                await this.app.vault.modify(file, dailyNoteContent);
            }

            let previousDay!: OneDay;
            // if deleteOnComplete, get yesterday's content and modify it
            if (deleteOnComplete.value) {
                const lastDailyNoteContent = await this.app.vault.read(lastDailyNote);
                previousDay = new OneDay(lastDailyNote, `${lastDailyNoteContent}`);
                const lines = lastDailyNoteContent.split('\n');

                for (let i = lines.length; i >= 0; i--) {
                    if (todos_yesterday.includes(lines[i])) {
                        lines.splice(i, 1);
                    }
                }

                const modifiedContent = lines.join('\n');
                await this.app.vault.modify(lastDailyNote, modifiedContent);
            }

            // Let user know rollover has been successful with X todos
            const todosAddedString =
                todosAdded == 0 ? '' : `- ${todosAdded} todo${todosAdded > 1 ? 's' : ''} rolled over.`;
            const emptiesToNotAddToTomorrowString =
                emptiesToNotAddToTomorrow == 0
                    ? ''
                    : deleteOnComplete.value
                    ? `- ${emptiesToNotAddToTomorrow} empty todo${emptiesToNotAddToTomorrow > 1 ? 's' : ''} removed.`
                    : '';
            const part1 = templateHeadingNotFoundMessage.length > 0 ? `${templateHeadingNotFoundMessage}` : '';
            const part2 = `${todosAddedString}${todosAddedString.length > 0 ? ' ' : ''}`;
            const part3 = `${emptiesToNotAddToTomorrowString}${emptiesToNotAddToTomorrowString.length > 0 ? ' ' : ''}`;

            const allParts = [part1, part2, part3];
            const nonBlankLines: string[] = [];
            allParts.forEach(part => {
                if (part.length > 0) {
                    nonBlankLines.push(part);
                }
            });

            const message = nonBlankLines.join('\n');
            if (message.length > 0) {
                new Notice(message, 4000 + message.length * 3);
            }
            this.undoHistoryTime = new Date();
            this.undoHistory = [new UndoHistoryInstance(previousDay, today)];
        }
    }

    async activateView() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXAMPLE);

        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_EXAMPLE,
            active: true,
        });
        this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE)[0] as WorkspaceLeaf);
    }

    public static getEditorPositionFromIndex(content: string, index: number): EditorPosition {
        const substr = content.substr(0, index);

        let l = 0;
        let offset = -1;
        let r = -1;
        for (; (r = substr.indexOf('\n', r + 1)) !== -1; l++, offset = r);
        offset += 1;

        const ch = content.substr(offset, index - offset).length;

        return { line: l, ch: ch };
    }

    async customizePaste(evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView): Promise<void> {
        Logger.warn(evt);
        Logger.dir(evt.clipboardData?.files);
        const clipboardText = evt.clipboardData?.getData('text/plain') || 'xxx';
        Logger.warn(clipboardText);
        // evt.clipboardData?.setDragImage
        await evt.clipboardData?.setData('text/plain', 'Hello, world!');
        // if (clipboardText == null || clipboardText == '') return;
        evt.stopPropagation();
        evt.preventDefault();
        const newText = evt.clipboardData?.getData('text/plain') || 'lalala';
        const text = editor.getValue();
        const start = text.indexOf(clipboardText);
        if (start < 0) {
            Logger.log(`Unable to find text "${clipboardText}" in current editor`);
        } else {
            const end = start + clipboardText.length;
            const startPos = ObsidianManagerPlugin.getEditorPositionFromIndex(text, start);
            const endPos = ObsidianManagerPlugin.getEditorPositionFromIndex(text, end);
            Logger.warn(newText);
            editor.replaceRange(newText, startPos, endPos);
            return;
        }
    }

    override async onload(): Promise<void> {
        this.setupUI();
        this.setupCommands();
        this.registerMarkdownPostProcessor((element, context) => {
            const codeblocks = element.querySelectorAll('code');
            for (let index = 0; index < codeblocks.length; index++) {
                const codeblock = codeblocks.item(index);
                const text = codeblock.innerText.trim();
                const isEmoji = text[0] === ':' && text[text.length - 1] === ':';

                if (isEmoji) {
                    // highlight-next-line
                    context.addChild(new Emoji(codeblock, text));
                }
            }
        });
        this.app.workspace.onLayoutReady(async () => {
            await this.pluginDataIO.load();
            if (this.pluginDataIO.debug.value) {
                monkeyPatchConsole(this);
            }
            this.watchVault();
            this.startPeriodicTask();
        });
    }

    private startPeriodicTask() {
        let intervalTaskRunning = true;
        // Force the view to refresh as soon as possible.
        this.periodicTask().finally(() => {
            intervalTaskRunning = false;
        });

        // Set up the recurring check for reminders.
        this.registerInterval(
            window.setInterval(() => {
                if (intervalTaskRunning) {
                    console.log('Skip reminder interval task because task is already running.');
                    return;
                }
                intervalTaskRunning = true;
                this.periodicTask().finally(() => {
                    intervalTaskRunning = false;
                });
            }, SETTINGS.reminderCheckIntervalSec.value * 1000),
        );
    }

    private async periodicTask(): Promise<void> {
        if (!this.pluginDataIO.scanned.value) {
            this.remindersController.reloadAllFiles().then(() => {
                this.pluginDataIO.scanned.value = true;
                this.pluginDataIO.save();
            });
        }

        this.pluginDataIO.save(false);

        if (this.editDetector.isEditing()) {
            return;
        }
        const expired = this.reminders.getExpiredReminders(SETTINGS.reminderTime.value);

        let previousReminder: Reminder | undefined = undefined;
        for (const reminder of expired) {
            if (this.app.workspace.layoutReady) {
                if (reminder.muteNotification) {
                    // We don't want to set `previousReminder` in this case as the current
                    // reminder won't be shown.
                    continue;
                }
                if (previousReminder) {
                    while (previousReminder.beingDisplayed) {
                        // Displaying too many reminders at once can cause crashes on
                        // mobile. We use `beingDisplayed` to wait for the current modal to
                        // be dismissed before displaying the next.
                        await this.sleep(100);
                    }
                }
                this.showReminder(reminder);
                console.log(reminder);
                previousReminder = reminder;
            }
        }
    }

    /* An asynchronous sleep function. To use it you must `await` as it hands
     * off control to other portions of the JS control loop whilst waiting.
     *
     * @param milliseconds - The number of milliseconds to wait before resuming.
     */
    private async sleep(milliseconds: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    private showReminder(reminder: Reminder) {
        reminder.muteNotification = true;
        this.reminderModal.show(
            reminder,
            time => {
                console.info('Remind me later: time=%o', time);
                reminder.time = time;
                reminder.muteNotification = false;
                this.remindersController.updateReminder(reminder, false);
                this.pluginDataIO.save(true);
            },
            () => {
                console.info('done');
                reminder.muteNotification = false;
                this.remindersController.updateReminder(reminder, true);
                this.reminders.removeReminder(reminder);
                this.pluginDataIO.save(true);
            },
            () => {
                console.info('Mute');
                reminder.muteNotification = true;
            },
            () => {
                console.info('Open');
                this.openReminderFile(reminder);
            },
        );
    }

    private async openReminderFile(reminder: Reminder) {
        const leaf = this.app.workspace.getUnpinnedLeaf();
        await this.remindersController.openReminder(reminder, leaf);
    }

    override async onunload(): Promise<void> {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXAMPLE);
    }

    private setupCommands() {
        this.addCommand({
            id: 'insert-link',
            name: 'Insert link',
            // 带条件的编辑器指令
            // editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {}
            // 编辑器指令
            editorCallback: (editor: Editor) => {
                const selectedText = editor.getSelection();

                const onSubmit = (text: string, url: string) => {
                    editor.replaceSelection(`[${text}](${url})`);
                };

                new InsertLinkModal(this.app, selectedText, onSubmit).open();
            },
        });

        this.addCommand({
            id: 'obsidian-manager-sayHello1',
            name: 'Say Example1Modal',
            callback: () => {
                const eve = (...args: any[]) => {
                    Logger.warn(...args);
                };
                new Example1Modal(this.app).open();
            },
        });

        this.addCommand({
            id: 'obsidian-manager-sayHello',
            name: 'Say Hello',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
            callback: () => {
                this.sayHello();
                // TODO 读取配置，防止泄露密码
                // axios
                //     .post('https://ntfy.ihave.cool/test', 'Look ma, with auth', {
                //         headers: {
                //             Authorization: 'Basic xxx',
                //         },
                //     })
                //     .then(res => Logger.log(res));
            },
        });

        this.addCommand({
            id: 'obsidian-manager-rollover',
            name: 'Rollover Todos Now',
            callback: () => this.rollover(undefined),
        });

        this.addCommand({
            id: 'obsidian-manager-undo',
            name: 'Undo last rollover',
            // 带条件的指令
            checkCallback: checking => {
                // no history, don't allow undo
                if (this.undoHistory.length > 0) {
                    const now = moment();
                    const lastUse = moment(this.undoHistoryTime);
                    const diff = now.diff(lastUse, 'seconds');
                    // 2+ mins since use: don't allow undo
                    if (diff > 2 * 60) {
                        return false;
                    }
                    // if (!checking) {
                    // 	new UndoModal(this).open();
                    // }
                    return true;
                }
                return false;
            },
        });
    }

    private setupUI() {
        this.registerView(VIEW_TYPE_EXAMPLE, leaf => new ExampleView(leaf));
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXAMPLE);
        // 自定义图标
        addIcon('circle', '<circle cx="50" cy="50" r="50" fill="currentColor" />');
        // 状态栏图标
        const item = this.addStatusBarItem();
        item.createEl('span', { text: 'Hello from the status bar 👋' });
        // setIcon(item, "info", 14);
        const fruits = this.addStatusBarItem();
        fruits.createEl('span', { text: '🍎' });
        fruits.createEl('span', { text: '🍌' });

        const veggies = this.addStatusBarItem();
        veggies.createEl('span', { text: '🥦' });
        veggies.createEl('span', { text: '🥬' });
        // 设置选项卡
        this.addSettingTab(new ReminderSettingTab(this.app, this, this.pluginDataIO));
        // 左侧菜单，使用自定义图标
        this.addRibbonIcon('circle', 'Sample Plugin', event => {
            new Notice('This is a notice!');
            const menu = new Menu();
            menu.addItem(item =>
                item
                    .setTitle('Test')
                    .setIcon('documents')
                    .onClick(() => {
                        new Notice('Tested');
                    }),
            );
            menu.showAtMouseEvent(event);
        });
        this.addRibbonIcon('dice', 'Activate view', () => {
            this.activateView();
        });
    }

    private watchVault() {
        [
            this.app.workspace.on('editor-paste', this.pasteFunction),
            this.app.workspace.on('file-menu', (menu, file) => {
                menu.addItem(item => {
                    item.setTitle('Print file path 👈')
                        .setIcon('document')
                        .onClick(async () => {
                            new Notice(file.path);
                        });
                });
            }),
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                menu.addItem(item => {
                    item.setTitle('Print file path 👈')
                        .setIcon('document')
                        .onClick(async () => {
                            new Notice(view.file.path);
                        });
                });
            }),
            this.app.vault.on('create', async file => {
                // TODO 增加开关，决定是否自动rollover
                // this.rollover(file as TFile);
            }),
            this.app.vault.on('modify', async file => {
                this.remindersController.reloadFile(file, true);
            }),
            this.app.vault.on('delete', file => {
                const { format } = getDailyNoteSettings();
                const today = new Date();
                const todayFormatted = moment(today).format(format);
                if (
                    file.name == todayFormatted + '.md' &&
                    this.app.commands.commands['obsidian-day-planner:app:unlink-day-planner-from-note']
                ) {
                    this.app.commands.executeCommandById('obsidian-day-planner:app:unlink-day-planner-from-note');
                }
                this.remindersController.removeFile(file.path);
            }),
            this.app.vault.on('rename', async (file, oldPath) => {
                // We only reload the file if it CAN be deleted, otherwise this can
                // cause crashes.
                if (await this.remindersController.removeFile(oldPath)) {
                    // We need to do the reload synchronously so as to avoid racing.
                    await this.remindersController.reloadFile(file);
                }
            }),
        ].forEach(eventRef => {
            this.registerEvent(eventRef);
        });
    }
}

class EditDetector {
    private lastModified?: Date;

    constructor(private editDetectionSec: ReadOnlyReference<number>) {}

    fileChanged() {
        this.lastModified = new Date();
    }

    isEditing(): boolean {
        if (this.editDetectionSec.value <= 0) {
            return false;
        }
        if (this.lastModified == null) {
            return false;
        }
        const elapsedSec = (new Date().getTime() - this.lastModified.getTime()) / 1000;
        return elapsedSec < this.editDetectionSec.value;
    }
}
