import type { EditorPosition, PluginManifest } from 'obsidian';
import { App, Editor, MarkdownView, Menu, Notice, Plugin, TFile, WorkspaceLeaf, addIcon, setIcon } from 'obsidian';
import moment from 'moment';
import type { ExtApp, ExtTFile } from 'types';
import { EditDetector, OneDay, Tag, UndoHistoryInstance } from 'types';
import { emojiCursor } from 'cursor-effects';
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
import Logger, { toggleDebugEnable } from 'utils/logger';
import { notify } from 'utils/request';
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
import { EditorState, Extension, RangeSetBuilder, StateEffect, StateField, Transaction } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// setting for rtl support
class Settings {
    public fileDirections: { [path: string]: string } = {};
    public defaultDirection = 'ltr';
    public rememberPerFile = true;
    public setNoteTitleDirection = true;
    public setYamlDirection = false;

    toJson() {
        return JSON.stringify(this);
    }

    fromJson(content: string) {
        const obj = JSON.parse(content);
        this.fileDirections = obj['fileDirections'];
        this.defaultDirection = obj['defaultDirection'];
        this.rememberPerFile = obj['rememberPerFile'];
        this.setNoteTitleDirection = obj['setNoteTitleDirection'];
    }
}

class EmojiListPlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    destroy() {
        // console.log('destory====');
    }

    buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from,
                to,
                enter(node) {
                    if (node.type.name.startsWith('list')) {
                        // Position of the '-' or the '*'.
                        const listCharFrom = node.from - 2;

                        builder.add(
                            listCharFrom,
                            listCharFrom + 1,
                            Decoration.replace({
                                widget: new EmojiWidget(),
                            }),
                        );
                    }
                },
            });
        }

        return builder.finish();
    }
}

const pluginSpec: PluginSpec<EmojiListPlugin> = {
    decorations: (value: EmojiListPlugin) => value.decorations,
};

const emojiListPlugin = ViewPlugin.fromClass(EmojiListPlugin, pluginSpec);

class EmojiWidget extends WidgetType {
    toDOM(view: EditorView): HTMLElement {
        const div = document.createElement('span');

        div.innerText = '👉';

        return div;
    }
}

const MAX_TIME_SINCE_CREATION = 5000; // 5 seconds

let shakeTime = 0,
    shakeTimeMax = 0,
    lastTime = 0,
    particlePointer = 0,
    effect,
    isActive = false,
    cmNode,
    canvas,
    ctx;

const shakeIntensity = 5,
    particles = [],
    MAX_PARTICLES = 500,
    PARTICLE_NUM_RANGE = { min: 5, max: 10 },
    PARTICLE_GRAVITY = 0.08,
    PARTICLE_ALPHA_FADEOUT = 0.96,
    PARTICLE_VELOCITY_RANGE = {
        x: [-1, 1],
        y: [-3.5, -1.5],
    },
    codemirrors = [],
    w = window.innerWidth,
    h = window.innerHeight;

const throttledShake = throttle(shake, 100);
const throttledSpawnParticles = throttle(spawnParticles, 100);

function getRGBComponents(node) {
    const color = getComputedStyle(node).color;
    if (color) {
        try {
            return color.match(/(\d+), (\d+), (\d+)/).slice(1);
        } catch (e) {
            return [255, 255, 255];
        }
    } else {
        return [255, 255, 255];
    }
}

function spawnParticles(cm, type) {
    const cursorPos = cm.getCursor();
    const pos = cm.coordsAtPos(cursorPos);
    const node = document.elementFromPoint(pos.left - 5, pos.top + 5);
    type = cm.wordAt(cursorPos);
    if (type) {
        type = type.type;
    }
    const numParticles = random(PARTICLE_NUM_RANGE.min, PARTICLE_NUM_RANGE.max);
    const color = getRGBComponents(node);

    for (let i = numParticles; i--; ) {
        particles[particlePointer] = createParticle(pos.left + 10, pos.top, color);
        particlePointer = (particlePointer + 1) % MAX_PARTICLES;
    }
}

function createParticle(x, y, color) {
    const p = {
        x: x,
        y: y + 10,
        alpha: 1,
        color: color,
    };
    if (effect === 1) {
        p.size = random(2, 4);
        p.vx =
            PARTICLE_VELOCITY_RANGE.x[0] +
            Math.random() * (PARTICLE_VELOCITY_RANGE.x[1] - PARTICLE_VELOCITY_RANGE.x[0]);
        p.vy =
            PARTICLE_VELOCITY_RANGE.y[0] +
            Math.random() * (PARTICLE_VELOCITY_RANGE.y[1] - PARTICLE_VELOCITY_RANGE.y[0]);
    } else if (effect === 2) {
        p.size = random(2, 8);
        p.drag = 0.92;
        p.vx = random(-3, 3);
        p.vy = random(-3, 3);
        p.wander = 0.15;
        p.theta = (random(0, 360) * Math.PI) / 180;
    }
    return p;
}

function effect1(particle) {
    particle.vy += PARTICLE_GRAVITY;
    particle.x += particle.vx;
    particle.y += particle.vy;

    particle.alpha *= PARTICLE_ALPHA_FADEOUT;

    ctx.fillStyle =
        'rgba(' + particle.color[0] + ',' + particle.color[1] + ',' + particle.color[2] + ',' + particle.alpha + ')';
    ctx.fillRect(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, particle.size);
}

// Effect based on Soulwire's demo: http://codepen.io/soulwire/pen/foktm
function effect2(particle) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
    particle.theta += random(-0.5, 0.5);
    particle.vx += Math.sin(particle.theta) * 0.1;
    particle.vy += Math.cos(particle.theta) * 0.1;
    particle.size *= 0.96;

    ctx.fillStyle =
        'rgba(' + particle.color[0] + ',' + particle.color[1] + ',' + particle.color[2] + ',' + particle.alpha + ')';
    ctx.beginPath();
    ctx.arc(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, 0, 2 * Math.PI);
    ctx.fill();
}

function drawParticles() {
    let particle;
    for (let i = particles.length; i--; ) {
        particle = particles[i];
        if (!particle || particle.alpha < 0.01 || particle.size <= 0.5) {
            continue;
        }

        if (effect === 1) {
            effect1(particle);
        } else if (effect === 2) {
            effect2(particle);
        }
    }
}

function shake(editor: Editor, time) {
    window.editor = editor;
    // cmNode = editor.cm;
    cmNode = editor.containerEl;
    shakeTime = shakeTimeMax = time;
}

function random(min, max) {
    if (!max) {
        max = min;
        min = 0;
    }
    return min + ~~(Math.random() * (max - min + 1));
}

function throttle(callback, limit) {
    let wait = false;
    return function () {
        if (!wait) {
            // eslint-disable-next-line prefer-rest-params
            callback.apply(this, arguments);
            wait = true;
            setTimeout(function () {
                wait = false;
            }, limit);
        }
    };
}

function loop() {
    if (!isActive) {
        return;
    }

    ctx.clearRect(0, 0, w, h);

    // get the time past the previous frame
    const current_time = new Date().getTime();
    if (!lastTime) lastTime = current_time;
    const dt = (current_time - lastTime) / 1000;
    lastTime = current_time;
    if (shakeTime > 0) {
        shakeTime -= dt;
        const magnitude = (shakeTime / shakeTimeMax) * shakeIntensity;
        const shakeX = random(-magnitude, magnitude);
        const shakeY = random(-magnitude, magnitude);
        cmNode.style.transform = 'translate(' + shakeX + 'px,' + shakeY + 'px)';
    }
    drawParticles();
    requestAnimationFrame(loop);
}

function onCodeMirrorChange(editor) {
    // eslint-disable-next-line no-constant-condition
    if (1 == 1) {
        // editor.getOption('blastCode') === true || editor.getOption('blastCode').shake === undefined
        throttledShake(editor, 0.3);
    }
    throttledSpawnParticles(editor);
}

function init(editor) {
    isActive = true;

    if (!canvas) {
        canvas = document.createElement('canvas');
        (ctx = canvas.getContext('2d')), (canvas.id = 'code-blast-canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = 0;
        canvas.style.left = 0;
        canvas.style.zIndex = 1;
        canvas.style.pointerEvents = 'none';
        canvas.width = w;
        canvas.height = h;

        document.body.appendChild(canvas);
        loop();
    }
}

function destroy(editor) {
    codemirrors.splice(codemirrors.indexOf(editor), 1);
    if (!codemirrors.length) {
        isActive = false;
        if (canvas) {
            canvas.remove();
            canvas = null;
        }
    }
}

export default class ObsidianManagerPlugin extends Plugin {
    override app: ExtApp;
    pluginDataIO: PluginDataIO;
    public SETTINGS_PATH = '.obsidian/rtl.json';
    public settings = new Settings();
    private currentFile: TFile;
    private undoHistory: any[];
    private undoHistoryTime: Date;
    private remindersController: RemindersController;
    private editDetector: EditDetector;
    private reminderModal: ReminderModal;
    // private autoComplete: AutoComplete;
    private reminders: Reminders;
    pasteFunction: (evt: ClipboardEvent, editor: Editor, markdownView: MarkdownView) => any;
    customSnippetPath: string;
    useSnippet = true;
    style: HTMLStyleElement;

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
        // TODO 完善
        this.pasteFunction = this.customizePaste.bind(this);
    }

    get snippetPath() {
        return this.app.customCss.getSnippetPath(this.customSnippetPath);
    }

    addTag(tag: Tag) {
        if (!tag) return;
        const rules = [
            `body.tag-pill-outlined .cm-s-obsidian:not([class="markdown-source-view cm-s-obsidian mod-cm6"]) span.cm-hashtag.cm-meta.cm-hashtag-end:is(.cm-tag-important,.cm-tag-complete,.cm-tag-ideas,.cm-tag-${tag.type},.cm-tag-weeklynote,.cm-tag-dailynote,.cm-tag-inprogress):not(.cm-formatting-hashtag) {
                border-top: var(--tag-border-width) solid var(--tag1);
                border-bottom: var(--tag-border-width) solid var(--tag1);
            }`,
            `body:not(.tag-default) .tag[href ^="#${tag.type}"]:not(.token) {
                background-color: var(--tag-${tag.type}-bg) !important;
                font-weight: 600;
                font-family: ${tag.font.fontFamily} !important;
                color: ${tag.color} !important;
                filter: hue-rotate(0) !important;
            }`,
            `body:not(.tag-default) .tag[href^="#${tag.type}"]::after {
                content: ' ❓';
                font-size: var(--font-size-emoji-after-tag);
            }`,
            `body:not(.tag-default) .cm-s-obsidian:not([class="markdown-source-view cm-s-obsidian mod-cm6"]) span.cm-tag-${tag.type}:not(.cm-formatting-hashtag)::after {
                content: ' ❓';
            }`,
            `body:not(.tag-default) .cm-s-obsidian:not([class="markdown-source-view cm-s-obsidian mod-cm6"]) span.cm-hashtag.cm-meta.cm-hashtag-end.cm-tag-${tag.type}:not(.cm-formatting-hashtag) {
                font-family: ${tag.font.fontFamily} !important;
                font-weight: 600;
                background-color: ${tag.bgColor} !important;
                color: ${tag.color} !important;
                font-size: ${tag.font.size};
                filter: hue-rotate(0) !important;
            }`,
            `body:not(.tag-default) .cm-s-obsidian:not([class="markdown-source-view cm-s-obsidian mod-cm6"]) .cm-formatting.cm-formatting-hashtag.cm-hashtag.cm-hashtag-begin.cm-meta.cm-tag-${tag.type} {
                font-weight: 600;
                font-family: ${tag.font.fontFamily} !important;
                display: inline;
                color: ${tag.color} !important;
                background-color: ${tag.bgColor} !important;
                filter: hue-rotate(0) !important;
                --callout-icon: ${tag.icon.name};  /* Icon name from the Obsidian Icon Set */
            }`,
        ];
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
        this.registerEditorExtension(lineNumbers());
        this.registerEditorExtension(emojiListPlugin);
        const editor = this.app.workspace.activeEditor;
        codemirrors.push(editor);
        effect = 2;
        init(editor);
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
            toggleDebugEnable(SETTINGS.debugEnable.value);
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

    override async onunload(): Promise<void> {
        destroy(this.app.workspace.activeEditor?.editor);
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXAMPLE);
        this.style.detach();
    }

    private setupCommands() {
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
            id: 'demo show',
            name: 'demo show',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 't' }],
            editorCallback: (editor: Editor, view: MarkdownView) => {
                // this.sayHello();
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
                this.addTag(new Tag('yellow', 'blue', 'juck', { name: '' }, { fontFamily: '' }));
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
        if (this.settings.rememberPerFile && this.currentFile && this.currentFile.path) {
            this.settings.fileDirections[this.currentFile.path] = newDirection;
            this.saveSettings();
        }
    }

    saveSettings() {
        const settings = this.settings.toJson();
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

        if (this.settings.setNoteTitleDirection) {
            const container = view.containerEl.parentElement;
            const header = container.getElementsByClassName('view-header-title-container');
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
            editorDiv.parentElement.classList.add('is-rtl');
        } else {
            editorDiv.parentElement.classList.remove('is-rtl');
        }
    }

    setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: string) {
        readingDiv.style.direction = newDirection;
        // Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
        if (newDirection === 'rtl') readingDiv.classList.add('is-rtl');
        else readingDiv.classList.remove('is-rtl');
        if (this.settings.setYamlDirection)
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
        // 输入特效，power mode, 参考https://github.com/codeinthedark/awesome-power-mode
        // 鼠标特效，增加开启关闭入口
        // new emojiCursor({ emoji: ['🔥', '🐬', '🦆'] });
        // 状态栏图标
        const obsidianManagerStatusBar = this.addStatusBarItem();
        // obsidianManagerStatusBar.createEl('span', { text: '🍎' });
        setIcon(obsidianManagerStatusBar, 'swords', 14);
        // 自定义图标
        // addIcon('circle', '<circle cx="50" cy="50" r="50" fill="currentColor" />');
        // 设置选项卡
        this.addSettingTab(new ReminderSettingTab(this.app, this, this.pluginDataIO));
        this.registerView(VIEW_TYPE_EXAMPLE, leaf => new ExampleView(leaf));
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXAMPLE);
        // 左侧菜单，使用自定义图标
        this.addRibbonIcon('swords', 'Obsidian Manager', event => {
            new Notice('This is a notice!');
            const menu = new Menu();
            menu.addItem(item =>
                item
                    .setTitle('Activate view')
                    .setIcon('activity')
                    .onClick(() => {
                        new Notice('Activate view');
                        this.activateView();
                    }),
            );
            menu.showAtMouseEvent(event);
        });
    }

    private watchVault() {
        [
            this.app.workspace.on('editor-change', (editor: Editor) => {
                onCodeMirrorChange(editor);
            }),
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
                    item.setTitle('Start a pomodoro timer 👈')
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
