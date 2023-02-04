import {
    EditorPosition,
    MarkdownFileInfo,
    PluginManifest,
    TAbstractFile,
    Tasks,
    WorkspaceWindow,
    normalizePath,
} from 'obsidian';
import {
    App,
    Editor,
    MarkdownView,
    Menu,
    Notice,
    Plugin,
    TFile,
    WorkspaceLeaf,
    addIcon,
    debounce,
    setIcon,
} from 'obsidian';
import moment from 'moment';
import type { ExtApp, ExtTFile } from 'types';
import { EditDetector, OneDay, Tag, UndoHistoryInstance } from 'types';
import {
    FocusPortalEvent,
    LoadPortalEvent,
    OpenFilePortalEvent,
    SpawnPortalEvent,
    VaultChange,
    eventTypes,
} from 'types/types';
import { getAllDailyNotes, getDailyNote, getDailyNoteSettings } from 'obsidian-daily-notes-interface';
import { RemindersController } from 'controller';
import { PluginDataIO } from 'data';
import { Reminder, Reminders } from 'model/reminder';
import { ReminderSettingTab, SETTINGS } from 'settings';
import { DATE_TIME_FORMATTER } from 'model/time';
import { monkeyPatchConsole } from 'obsidian-hack/obsidian-debug-mobile';
import { Example1Modal, Example2Modal, InsertLinkModal } from 'ui/modal/insert-link-modal';
import { POMODORO_HISTORY_VIEW, PomodoroHistoryView } from 'ui/PomodoroHistoryView';
import { codeEmoji } from 'render/Emoji';
import { disableCursorEffect, effects, enableCursorEffect } from 'render/CursorEffects';
import { buildTagRules } from 'render/Tag';
import { ReminderModal } from 'ui/reminder';
import Logger, { toggleDebugEnable } from 'utils/logger';
import { notify } from 'utils/request';
import { getNotePath } from 'utils/file';
import { dbResultsToDBTables, getDB, insertIntoDB, saveDBAndKeepAlive, saveDBToPath, selectDB } from 'utils/db/db';
import { insertAfterHandler, setBanner } from 'utils/content';
import { searchPicture } from 'utils/genBanner';
import { loadSQL } from 'utils/db/sqljs';
import { initiateDB } from 'utils/promotodo';
import type { Database } from 'sql.js';
import {
    Decoration,
    DecorationSet,
    EditorView,
    PluginSpec,
    PluginValue,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
    lineNumbers,
} from '@codemirror/view';
import { imgpath } from 'utils/genBanner';
import { DocumentDirectionSettings } from './render/DocumentDirection';
import { emojiListPlugin } from './render/EmojiList';
import { destroyBlast, initBlast, onCodeMirrorChange } from './render/Blast';

const MAX_TIME_SINCE_CREATION = 5000; // 5 seconds
const checkInDefaultPath = 'Journal/Habit';
const checkInList = [
    {
        filename: 'Get up',
        content: '[[Get up]] and sit in [[meditation]]',
        time: '07:00',
    },
    {
        filename: '日记',
        content: '[[日记|Journal]]',
        time: '07:30',
    },
    {
        path: checkInDefaultPath,
        filename: 'Review',
        content: '[[Review]]',
        time: '07:30',
    },
    {
        path: checkInDefaultPath,
        filename: 'Breakfast',
        content: '[[Breakfast]]',
        time: '08:00',
    },
    {
        path: checkInDefaultPath,
        filename: 'leave for work',
        content: '[[leave for work]]',
        time: '09:00',
    },
    {
        path: checkInDefaultPath,
        filename: 'Launch',
        content: '[[Launch]] and take a break',
        time: '12:30',
    },
    {
        path: checkInDefaultPath,
        filename: 'Dinner',
        content: '[[Dinner]] ',
        time: '18:00',
    },
    {
        path: checkInDefaultPath,
        filename: 'Go through today',
        content: '[[Go through today]]',
        time: '22:30',
    },
    {
        path: checkInDefaultPath,
        filename: 'Plan for tomorrow',
        content: '[[Plan for tomorrow]]',
        time: '22:30',
    },
    {
        path: checkInDefaultPath,
        filename: 'End the day',
        content: '[[End the day]]',
        time: '23:00',
    },
];

export default class ObsidianManagerPlugin extends Plugin {
    override app: ExtApp;
    pluginDataIO: PluginDataIO;
    public SETTINGS_PATH = '.obsidian/rtl.json';
    public docDirSettings = new DocumentDirectionSettings();
    private currentFile: TFile;
    private undoHistory: any[];
    private undoHistoryTime: Date;
    private remindersController: RemindersController;
    private editDetector: EditDetector;
    private reminderModal: ReminderModal;
    private reminders: Reminders;
    quickPreviewFunction: (file: TFile, data: string) => any;
    resizeFunction: () => any;
    clickFunction: (evt: MouseEvent) => any;
    activeLeafChangeFunction: (leaf: WorkspaceLeaf | null) => any;
    fileOpenFunction: (file: TFile | null) => any;
    layoutChangeFunction: () => any;
    windowOpenFunction: (win: WorkspaceWindow, window: Window) => any;
    windowCloseFunction: (win: WorkspaceWindow, window: Window) => any;
    cssChangeFunction: () => any;
    fileMenuFunction: (menu: Menu, file: TAbstractFile, source: string, leaf?: WorkspaceLeaf) => any;
    editorMenuFunction: (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => any;
    editorChangeFunction: (editor: Editor, info: MarkdownView | MarkdownFileInfo) => any;
    editorPasteFunction: (evt: ClipboardEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) => any;
    editorDropFunction: (evt: DragEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) => any;
    codemirrorFunction: (cm: CodeMirror.Editor) => any;
    quitFunction: (tasks: Tasks) => any;

    vaultCreateFunction: (file: TAbstractFile) => any;
    vaultModifyFunction: (file: TAbstractFile) => any;
    vaultDeleteFunction: (file: TAbstractFile) => any;
    vaultRenameFunction: (file: TAbstractFile, oldPath: string) => any;
    vaultClosedFunction: () => any;

    customSnippetPath: string;
    useSnippet = true;
    style: HTMLStyleElement;
    spacesDBPath: string;
    spaceDB: Database;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.app = app as ExtApp;
        this.reminders = new Reminders(() => {
            this.pluginDataIO.changed = true;
        });
        this.customSnippetPath = 'obsidian-manager';
        this.undoHistory = [];
        this.undoHistoryTime = new Date();
        this.pluginDataIO = new PluginDataIO(this, this.reminders);
        this.reminders.reminderTime = SETTINGS.reminderTime;
        DATE_TIME_FORMATTER.setTimeFormat(SETTINGS.dateFormat, SETTINGS.dateTimeFormat, SETTINGS.strictDateFormat);
        this.editDetector = new EditDetector(SETTINGS.editDetectionSec);
        this.remindersController = new RemindersController(app.vault, this.reminders);
        this.reminderModal = new ReminderModal(this.app, SETTINGS.useSystemNotification, SETTINGS.laters);
        this.resizeFunction = this.customizeResize.bind(this);
        this.clickFunction = this.customizeClick.bind(this);
        this.editorMenuFunction = this.customizeEditorMenu.bind(this);
        this.editorChangeFunction = this.customizeEditorChange.bind(this);
        this.editorPasteFunction = this.customizeEditorPaste.bind(this);
        this.fileMenuFunction = this.customizeFileMenu.bind(this);
        this.vaultCreateFunction = this.customizeVaultCreate.bind(this);
        this.vaultModifyFunction = this.customizeVaultModify.bind(this);
        this.vaultDeleteFunction = this.customizeVaultDelete.bind(this);
        this.vaultRenameFunction = this.customizeVaultRename.bind(this);
    }

    async sqlJS() {
        // console.time("Loading SQlite");
        const sqljs = await loadSQL();
        // console.timeEnd("Loading SQlite");
        return sqljs;
    }

    mdbChange(e: any) {
        console.log(this, e);
    }

    saveSpacesDB = debounce(() => saveDBAndKeepAlive(this.spaceDBInstance(), this.spacesDBPath), 1000, true);

    spaceDBInstance() {
        return this.spaceDB;
    }

    async startPomodoro(task: string) {
        const start = moment().format('YYYY-MM-DD HH:mm:ss');
        insertIntoDB(this.spaceDB, {
            // vault: {
            //     uniques: ['path'],
            //     cols: ['path', 'parent', 'created', 'sticker', 'color', 'folder', 'rank'],
            //     rows: [{ path: new Date().getTime() + 'p' }, { path: new Date().getTime() + 1 + 'p' }],
            // },
            pomodoro: {
                uniques: ['timestamp'],
                cols: ['timestamp', 'task', 'start', 'end', 'spend', 'status'],
                rows: [{ timestamp: new Date().getTime() + '', task, start, status: 'ing' }],
            },
        });
        new Notice(`开始执行：${task}`);
        saveDBAndKeepAlive(this.spaceDB, this.spacesDBPath);
        const evt = new CustomEvent(eventTypes.pomodoroChange, { detail: { task, start } });
        window.dispatchEvent(evt);
        console.log(selectDB(this.spaceDBInstance(), 'pomodoro'));
    }

    async test() {
        console.log(selectDB(this.spaceDBInstance(), 'vault'));
    }

    get snippetPath() {
        return this.app.customCss.getSnippetPath(this.customSnippetPath);
    }

    addTag(tag: Tag) {
        if (!tag) return;
        const rules = buildTagRules(tag);
        rules.forEach(rule => this.style.sheet?.insertRule(rule, this.style.sheet.cssRules.length));
        this.updateSnippet();
    }

    generateCssString() {
        const sheet = [
            `/* This snippet was auto-generated by the Obsidian-manager plugin on ${new Date().toLocaleString()} */\n\n`,
            `
            body {
                --tag-border-width: 1px;
                --font-size-tag: 0.85em;
                --tag-questions: #d4bdff;
                --tag-questions-bg: #6640ae;
                --tag1: #3674bb;
                --stag1-bg: #bd1919;
                --white: white;
                --font-family-special-tag: "Lucida Handwriting", "Segoe UI Emoji";
                --font-size-emoji-after-tag: 1.5625em;
            }\n\n
            `,
        ];

        for (const rule of Array.from(this.style.sheet!.cssRules)) {
            sheet.push(rule.cssText);
        }
        return sheet.join('\n\n');
    }

    async updateSnippet() {
        if (!this.useSnippet) return;
        if (await this.app.vault.adapter.exists(this.snippetPath)) {
            await this.app.vault.adapter.write(this.snippetPath, this.generateCssString());
        } else {
            await this.app.vault.create(this.snippetPath, this.generateCssString());
        }
        this.app.customCss.setCssEnabledStatus(this.customSnippetPath, true);
        this.app.customCss.readSnippets();
    }

    isDailyNotesEnabled() {
        const dailyNotesPlugin = this.app.internalPlugins.plugins['daily-notes'];
        const dailyNotesEnabled = dailyNotesPlugin && dailyNotesPlugin.enabled;
        const periodicNotesPlugin = this.app.plugins.getPlugin('periodic-notes');
        const periodicNotesEnabled = periodicNotesPlugin && periodicNotesPlugin!.settings?.daily?.enabled;

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

    async addMyTag() {
        this.addTag(new Tag('yellow', 'blue', 'juck', { name: '' }, { fontFamily: '' }));
    }

    async sayHello() {
        // await this.remindersController.reloadAllFiles();
        // this.pluginDataIO.scanned.value = true;
        // this.pluginDataIO.save();
        // const expired = this.reminders.getExpiredReminders(SETTINGS.reminderTime.value);
        notify('test', {});
    }

    async rollover(file: TFile | undefined) {
        /*** First we check if the file created is actually a valid daily note ***/
        const { folder = '', format } = getDailyNoteSettings();
        let ignoreCreationTime = false;

        // Rollover can be called, but we need to get the daily file
        if (file == undefined) {
            const allDailyNotes = getAllDailyNotes();
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
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
        this.app.workspace.detachLeavesOfType(POMODORO_HISTORY_VIEW);
        await this.app.workspace.getRightLeaf(false).setViewState({
            type: POMODORO_HISTORY_VIEW,
            active: true,
        });
        this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(POMODORO_HISTORY_VIEW)[0] as WorkspaceLeaf);
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

    async customizeResize(): Promise<void> {
        console.log('resize');
    }

    async customizeClick(evt: MouseEvent): Promise<void> {
        console.log('customizeClick');
    }

    async customizeEditorMenu(menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo): Promise<void> {
        menu.addItem(item => {
            item.setTitle('Start a pomodoro')
                .setIcon('clock')
                .onClick(async () => {
                    const cursorPos = editor.getCursor();
                    let task = editor.getSelection();
                    if (!task) {
                        if (cursorPos) {
                            task = editor.getLine(cursorPos.line);
                        } else {
                            task = '默认任务';
                        }
                    }
                    this.startPomodoro(task);
                });
        });
    }
    async customizeEditorChange(editor: Editor, info: MarkdownView | MarkdownFileInfo): Promise<void> {
        onCodeMirrorChange(editor);
    }

    async customizeEditorPaste(evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView): Promise<void> {
        return;
        // const clipboardText = evt.clipboardData?.getData('text/plain');
        // if (!clipboardText) return;

        // Logger.warn(evt);
        // Logger.dir(evt.clipboardData?.files);
        // Logger.warn(clipboardText);
        // evt.clipboardData?.setDragImage
        // await evt.clipboardData?.setData('text/plain', 'Hello, world!');
        // evt.stopPropagation();
        // evt.preventDefault();

        // let newLine = clipboardText;
        // const text = editor.getValue();
        // const oldLine = editor.getLine(editor.getCursor().line);
        // if (oldLine.trimStart().startsWith('- [ ]') || newLine.trimStart().startsWith('- [ ]')) {
        //     const reg = /(\s*- \[ \]\s?)+/;
        //     newLine = newLine.replace(reg, '');
        // }
        // const start = text.indexOf(clipboardText);
        // if (start < 0) {
        //     Logger.log(`Unable to find text "${clipboardText}" in current editor`);
        // } else {
        //     const end = start + clipboardText.length;
        //     const startPos = ObsidianManagerPlugin.getEditorPositionFromIndex(text, start);
        //     const endPos = ObsidianManagerPlugin.getEditorPositionFromIndex(text, end);
        //     editor.replaceRange(newLine, startPos, endPos);
        //     return;
        // }
    }

    async customizeFileMenu(menu: Menu, file: TAbstractFile, source: string, leaf?: WorkspaceLeaf): Promise<void> {
        menu.addItem(item => {
            item.setTitle('Print file path 👈')
                .setIcon('document')
                .onClick(async () => {
                    new Notice(file.path);
                });
        });
    }

    async customizeVaultCreate(file: TAbstractFile): Promise<void> {
        // TODO 增加开关，决定是否自动rollover
        // this.rollover(file as TFile);
    }

    async customizeVaultModify(file: TAbstractFile): Promise<void> {
        this.remindersController.reloadFile(file, true);
    }

    async customizeVaultDelete(file: TAbstractFile): Promise<void> {
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
    }

    async customizeVaultRename(file: TAbstractFile, oldPath: string): Promise<void> {
        // We only reload the file if it CAN be deleted, otherwise this can
        // cause crashes.
        if (await this.remindersController.removeFile(oldPath)) {
            // We need to do the reload synchronously so as to avoid racing.
            await this.remindersController.reloadFile(file);
        }
    }

    override async onload(): Promise<void> {
        this.setupUI();
        this.setupCommands();
        this.registerMarkdownPostProcessor(codeEmoji);

        this.spacesDBPath = normalizePath(app.vault.configDir + '/plugins/obsidian-manager/ObsidianManager.mdb');
        this.spaceDB = await getDB(await loadSQL(), this.spacesDBPath);
        const tables = dbResultsToDBTables(
            this.spaceDBInstance().exec(
                "SELECT name FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%';",
            ),
        );
        if (tables.length == 0) {
            initiateDB(this.spaceDBInstance());
        }
        this.app.workspace.onLayoutReady(async () => {
            await this.pluginDataIO.load();
            if (this.pluginDataIO.debug.value) {
                monkeyPatchConsole(this);
            }
            this.watchVault();
            this.startPeriodicTask();
            this.style = document.head.createEl('style', {
                attr: { id: 'OBSIDIAN_MANAGER_CUSTOM_STYLE_SHEET' },
            });
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

    private async addACheck(path, filename, time, content) {
        const normalizedPath = await getNotePath(path, filename);
        const todayMoment = moment();
        const fileContents = await app.vault.adapter.read(normalizedPath);
        const newFileContent = await insertAfterHandler(
            '## 打卡',
            `- [ ] ${time} ${content} ⏳ ${todayMoment.format('YYYY-MM-DD')}`,
            fileContents,
        );
        await app.vault.adapter.write(normalizedPath, newFileContent.content);
    }

    private async removeACheck(path, filename, time, content) {
        const normalizedPath = await getNotePath(path, filename);
        const todayMoment = moment();
        const fileContents = await app.vault.adapter.read(normalizedPath);
        const originalLine = `- [ ] ${time} ${content} ⏳ ${todayMoment.format('YYYY-MM-DD')}`;
        const newContent = fileContents.replace(originalLine, '');
        await app.vault.adapter.write(normalizedPath, newContent);
    }

    private async habitCheckIn() {
        checkInList.forEach(habit => {
            const { path, filename, time, content } = habit;
            this.addACheck(path || checkInDefaultPath, filename, time, content);
        });
    }

    private async removeHabitCheckIn() {
        checkInList.forEach(habit => {
            const { path, filename, time, content } = habit;
            this.removeACheck(path || checkInDefaultPath, filename, time, content);
        });
    }

    override async onunload(): Promise<void> {
        destroyBlast();
        this.app.workspace.detachLeavesOfType(POMODORO_HISTORY_VIEW);
        this.style.detach();
    }

    async setRandomBanner(path?: string): Promise<void> {
        const allFilePaths = Object.keys(this.app.metadataCache.fileCache);
        const allMdFilePaths = allFilePaths.filter(
            key =>
                this.app.metadataCache.fileCache[key]['hash'] &&
                ['Notes', 'Journal', 'Inbox', 'Reading', 'MyObsidian', 'Archive'].contains(key.split('/')[0]),
        );
        const allMdFilePathsWithBanner = allMdFilePaths.filter(file => {
            const banner =
                this.app.metadataCache.metadataCache[this.app.metadataCache.fileCache[file].hash].frontmatter?.banner;
            // https://images.pexels
            //
            if (
                banner &&
                typeof banner == 'string' &&
                (banner.startsWith('https://dummyimage') ||
                    banner.startsWith('https://images.unsplash') ||
                    // banner.startsWith('https://images.pexels') ||
                    banner.startsWith('/'))
            ) {
                return true;
            } else {
                return false;
            }
        });
        console.log(allMdFilePathsWithBanner);
        let t = 0;
        allMdFilePathsWithBanner.forEach(async file => {
            const hash = this.app.metadataCache.fileCache[file].hash;
            const frontmatter = this.app.metadataCache.metadataCache[hash].frontmatter;
            const banner = frontmatter?.banner;
            const title = frontmatter?.title;
            (function (t, data) {
                setTimeout(async function () {
                    try {
                        // pixabay pexels
                        const newBanner = await searchPicture('pexels', title);
                        if (newBanner) {
                            const result = await setBanner(file, banner, newBanner);
                            if (result) {
                                console.info(title + '成功' + newBanner);
                            } else {
                                console.info(title + '失败' + result);
                            }
                        }
                    } catch (error) {
                        console.error(title + '错误');
                    }
                    console.log(`这是第 ${t} 次，这是其他参数：${data}`);
                }, 200 * t);
            })(t++, '其他参数');
        });
    }

    private setupCommands() {
        // this.addCommand({
        //     id: 'set-random-banner-for-current-file',
        //     name: 'Set Random Banner For Current File',
        //     callback: async () => {
        //         this.setRandomBanner('this file');
        //     },
        // });

        this.addCommand({
            id: 'set-random-banner-for-all-files',
            name: 'Danger Method!!! Set Random Banner For All Files',
            callback: async () => {
                this.setRandomBanner();
            },
        });

        this.addCommand({
            id: 'switch-text-direction',
            name: 'Switch Text Direction (LTR<>RTL)',
            callback: () => {
                this.toggleDocumentDirection();
                // const eve = (...args: any[]) => {
                //     Logger.warn(...args);
                // };
                // new Example1Modal(this.app).open();
            },
        });

        this.addCommand({
            id: 'obsidian-manager-check-in',
            name: 'Habit Check In',
            callback: () => {
                this.habitCheckIn();
            },
        });

        this.addCommand({
            id: 'obsidian-manager-remove-check-in',
            name: 'Remove Habit Check In',
            callback: () => {
                this.removeHabitCheckIn();
            },
        });

        this.addCommand({
            id: 'toggle-debug',
            name: 'Toggle debug',
            callback: () => {
                toggleDebugEnable();
            },
        });

        this.addCommand({
            id: 'enable-cursor-effect',
            name: 'Enable CursorEffect',
            callback: () => {
                const len = effects.length;
                const idx = Math.floor(Math.random() * len);
                enableCursorEffect(effects[idx]);
            },
        });

        this.addCommand({
            id: 'disable-cursor-effect',
            name: 'Disable CursorEffect',
            callback: () => {
                disableCursorEffect();
            },
        });

        this.addCommand({
            id: 'Test',
            name: 'test',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.test();
            },
        });

        this.addCommand({
            id: 'demo show',
            name: 'demo show',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 't' }],
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.sayHello();
            },
        });

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
            id: 'obsidian-manager-addMyTag',
            name: 'Add MyTag',
            callback: () => {
                this.addMyTag();
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

    toggleDocumentDirection() {
        const newDirection = this.getDocumentDirection() === 'ltr' ? 'rtl' : 'ltr';
        this.setDocumentDirection(newDirection);
        if (this.docDirSettings.rememberPerFile && this.currentFile && this.currentFile.path) {
            this.docDirSettings.fileDirections[this.currentFile.path] = newDirection;
            this.saveSettings();
        }
    }

    saveSettings() {
        const settings = this.docDirSettings.toJson();
        this.app.vault.adapter.write(this.SETTINGS_PATH, settings);
    }

    getDocumentDirection() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return 'unknown';
        const rtlEditors = view.contentEl.getElementsByClassName('is-rtl');
        if (rtlEditors.length > 0) return 'rtl';
        else return 'ltr';
    }

    setDocumentDirection(newDirection: string) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view?.editor) return;

        const editorDivs = view.contentEl.getElementsByClassName('cm-editor');
        for (const editorDiv of editorDivs) {
            if (editorDiv instanceof HTMLDivElement) this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
        }
        const markdownPreviews = view.contentEl.getElementsByClassName('markdown-preview-view');
        for (const preview of markdownPreviews) {
            if (preview instanceof HTMLDivElement) this.setDocumentDirectionForReadingDiv(preview, newDirection);
        }

        // --- General global fixes ---

        // Fix list indentation problems in RTL
        this.replacePageStyleByString(
            'List indent fix',
            '/* List indent fix */ .is-rtl .HyperMD-list-line { text-indent: 0px !important; }',
            true,
        );
        this.replacePageStyleByString(
            'CodeMirror-rtl pre',
            '.CodeMirror-rtl pre { text-indent: 0px !important; }',
            true,
        );

        // Embedded backlinks should always be shown as LTR
        this.replacePageStyleByString(
            'Embedded links always LTR',
            '/* Embedded links always LTR */ .embedded-backlinks { direction: ltr; }',
            true,
        );

        // Fold indicator fix (not perfect yet -- it can't be clicked)
        this.replacePageStyleByString(
            'Fold symbol fix',
            '/* Fold symbol fix*/ .is-rtl .cm-fold-indicator { right: -15px !important; }',
            true,
        );

        if (this.docDirSettings.setNoteTitleDirection) {
            const container = view.containerEl.parentElement;
            const header = container?.getElementsByClassName(
                'view-header-title-container',
            ) as HTMLCollectionOf<Element>;
            (header[0] as HTMLDivElement).style.direction = newDirection;
        }

        view.editor.refresh();

        // Set the *currently active* export direction. This is global and changes every time the user
        // switches a pane
        this.setExportDirection(newDirection);
    }

    setDocumentDirectionForEditorDiv(editorDiv: HTMLDivElement, newDirection: string) {
        editorDiv.style.direction = newDirection;
        if (newDirection === 'rtl') {
            editorDiv.parentElement?.classList.add('is-rtl');
        } else {
            editorDiv.parentElement?.classList.remove('is-rtl');
        }
    }

    setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: string) {
        readingDiv.style.direction = newDirection;
        // Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
        if (newDirection === 'rtl') readingDiv.classList.add('is-rtl');
        else readingDiv.classList.remove('is-rtl');
        if (this.docDirSettings.setYamlDirection)
            this.replacePageStyleByString(
                'Patch YAML',
                '/* Patch YAML RTL */ .is-rtl .language-yaml code { text-align: right; }',
                true,
            );
    }

    setExportDirection(newDirection: string) {
        this.replacePageStyleByString(
            'searched and replaced',
            `/* This is searched and replaced by the plugin */ @media print { body { direction: ${newDirection}; } }`,
            false,
        );
    }

    // Returns true if a replacement was made
    replacePageStyleByString(searchString: string, newStyle: string, addIfNotFound: boolean) {
        let alreadyExists = false;
        const style = this.findPageStyle(searchString);
        if (style) {
            if (style.getText() === searchString) alreadyExists = true;
            else style.setText(newStyle);
        } else if (addIfNotFound) {
            const style = document.createElement('style');
            style.textContent = newStyle;
            document.head.appendChild(style);
        }
        return style && !alreadyExists;
    }

    findPageStyle(regex: string) {
        const styles = document.head.getElementsByTagName('style');
        for (const style of styles) {
            if (style.getText().match(regex)) return style;
        }
        return null;
    }

    private setupUI() {
        // this.registerEditorExtension(lineNumbers());
        // this.registerEditorExtension(emojiListPlugin);
        // input power mode
        initBlast();
        // 状态栏图标
        const obsidianManagerStatusBar = this.addStatusBarItem();
        // obsidianManagerStatusBar.createEl('span', { text: '🍎' });
        setIcon(obsidianManagerStatusBar, 'swords');
        // 自定义图标
        // addIcon('circle', '<circle cx="50" cy="50" r="50" fill="currentColor" />');
        // 设置选项卡
        this.addSettingTab(new ReminderSettingTab(this.app, this, this.pluginDataIO));
        this.registerView(POMODORO_HISTORY_VIEW, leaf => new PomodoroHistoryView(leaf, this));
        this.app.workspace.detachLeavesOfType(POMODORO_HISTORY_VIEW);
        // 左侧菜单，使用自定义图标
        this.addRibbonIcon('swords', 'Obsidian Manager', event => {
            const menu = new Menu();
            menu.addItem(item =>
                item
                    .setTitle('Activate view')
                    .setIcon('activity')
                    .onClick(() => {
                        this.activateView();
                    }),
            );
            menu.showAtMouseEvent(event);
        });
    }

    private watchVault() {
        window.addEventListener(eventTypes.mdbChange, this.mdbChange.bind(this));
        // TODO partyjs
        window.onclick = () => {
            // xx
        };
        [
            this.app.workspace.on('click', this.clickFunction),
            this.app.workspace.on('resize', this.resizeFunction),
            this.app.workspace.on('editor-change', this.editorChangeFunction),
            this.app.workspace.on('editor-paste', this.editorPasteFunction),
            this.app.workspace.on('file-menu', this.fileMenuFunction),
            this.app.workspace.on('editor-menu', this.editorMenuFunction),
            this.app.vault.on('create', this.vaultCreateFunction),
            this.app.vault.on('modify', this.vaultModifyFunction),
            this.app.vault.on('delete', this.vaultDeleteFunction),
            this.app.vault.on('rename', this.vaultRenameFunction),
        ].forEach(eventRef => {
            this.registerEvent(eventRef);
        });
    }
}
