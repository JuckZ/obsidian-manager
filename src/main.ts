import {
	App,
	Notice,
	Plugin,
	PluginManifest,
	Setting,
	PluginSettingTab,
	TAbstractFile,
	TFile,
} from "obsidian";
import axios from "axios";
import {
	getDailyNoteSettings,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";
import { RemindersController } from "controller";
import { PluginDataIO } from "data";
import { Reminder, Reminders } from "model/reminder";
import { ReminderSettingTab, SETTINGS } from "settings";
import { DATE_TIME_FORMATTER } from "model/time";
import type { ReadOnlyReference } from "model/ref";
import { monkeyPatchConsole } from 'obsidian-hack/obsidian-debug-mobile';

const MAX_TIME_SINCE_CREATION = 5000; // 5 seconds

/* Just some boilerplate code for recursively going through subheadings for later
function createRepresentationFromHeadings(headings) {
  let i = 0;
  const tags = [];

  (function recurse(depth) {
    let unclosedLi = false;
    while (i < headings.length) {
      const [hashes, data] = headings[i].split("# ");
      if (hashes.length < depth) {
        break;
      } else if (hashes.length === depth) {
        if (unclosedLi) tags.push('</li>');
        unclosedLi = true;
        tags.push('<li>', data);
        i++;
      } else {
        tags.push('<ul>');
        recurse(depth + 1);
        tags.push('</ul>');
      }
    }
    if (unclosedLi) tags.push('</li>');
  })(-1);
  return tags.join('\n');
}
*/

export default class ObsidianManagerPlugin extends Plugin {
	pluginDataIO: PluginDataIO;
	private undoHistory: any[];
	private undoHistoryTime: Date;
	private remindersController: RemindersController;
	private settings: any;
	private reminders: Reminders;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.reminders = new Reminders(() => {
			this.pluginDataIO.changed = true;
		});
		this.pluginDataIO = new PluginDataIO(this, this.reminders);
		this.reminders.reminderTime = SETTINGS.reminderTime;
		DATE_TIME_FORMATTER.setTimeFormat(
			SETTINGS.dateFormat,
			SETTINGS.dateTimeFormat,
			SETTINGS.strictDateFormat
		);
		this.remindersController = new RemindersController(
			app.vault,
			this.reminders
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	isDailyNotesEnabled() {
		/* @ts-ignore */
		const dailyNotesPlugin = this.app.internalPlugins.plugins["daily-notes"];
		const dailyNotesEnabled = dailyNotesPlugin && dailyNotesPlugin.enabled;
		/* @ts-ignore */
		const periodicNotesPlugin = this.app.plugins.getPlugin("periodic-notes");
		const periodicNotesEnabled =
			periodicNotesPlugin && periodicNotesPlugin.settings?.daily?.enabled;

		return dailyNotesEnabled || periodicNotesEnabled;
	}

	getLastDailyNote(): TFile {
		const { moment } = window;
		const { folder = "", format } = getDailyNoteSettings();

		// get all notes in directory that aren't null
		const dailyNoteFiles = this.app.vault
			.getAllLoadedFiles()
			.filter((file) => file.path.startsWith(folder))
			/* @ts-ignore */
			.filter((file) => file.basename != null) as TFile[];

		// remove notes that are from the future
		const todayMoment = moment();
		let dailyNotesTodayOrEarlier: TFile[] = [];
		dailyNoteFiles.forEach((file) => {
			if (
				moment(file.basename, format).isSameOrBefore(todayMoment, "day")
			) {
				dailyNotesTodayOrEarlier.push(file);
			}
		});

		// sort by date
		const sorted = dailyNotesTodayOrEarlier.sort(
			(a, b) =>
				moment(b.basename, format).valueOf() -
				moment(a.basename, format).valueOf()
		);
		return sorted[1];
	}

	async getAllUnfinishedTodos(file: TFile) {
		const contents = await this.app.vault.read(file);
		const unfinishedTodosRegex = /\t*- \[ \].*/g;
		const unfinishedTodos = Array.from(
			contents.matchAll(unfinishedTodosRegex)
		).map(([todo]) => todo);

		return unfinishedTodos;
	}

	async sortHeadersIntoHeirarchy(file: TFile) {
		///console.log('testing')
		const templateContents = await this.app.vault.read(file);
		const allHeadings = Array.from(
			templateContents.matchAll(/#{1,} .*/g)
		).map(([heading]) => heading);

		if (allHeadings.length > 0) {
			// console.log(createRepresentationFromHeadings(allHeadings));
		}
	}

	async sayHello() {
		await this.remindersController.reloadAllFiles();
		this.pluginDataIO.scanned.value = true;
		this.pluginDataIO.save();
		const expired = this.reminders.getExpiredReminders(
			SETTINGS.reminderTime.value
		);
	}

	async rollover(file: TFile | undefined) {
		/*** First we check if the file created is actually a valid daily note ***/
		const { folder = "", format } = getDailyNoteSettings();
		let ignoreCreationTime = false;

		// Rollover can be called, but we need to get the daily file
		if (file == undefined) {
			const allDailyNotes = getAllDailyNotes();
			file = getDailyNote(window.moment(), allDailyNotes);
			ignoreCreationTime = true;
		}
		if (!file) return;

		// is a daily note
		if (!file.path.startsWith(folder)) return;

		// is today's daily note
		const today = new Date();
		const todayFormatted = window.moment(today).format(format);
		if (todayFormatted !== file.basename) return;

		// was just created
		if (
			today.getTime() - file.stat.ctime > MAX_TIME_SINCE_CREATION &&
			!ignoreCreationTime
		)
			return;

		/*** Next, if it is a valid daily note, but we don't have daily notes enabled, we must alert the user ***/
		if (!this.isDailyNotesEnabled()) {
			new Notice(
				"ObsidianManagerPlugin unable to rollover unfinished todos: Please enable Daily Notes, or Periodic Notes (with daily notes enabled).",
				10000
			);
		} else {
			const { templateHeading, deleteOnComplete, removeEmptyTodos } =
				this.settings;

			// check if there is a daily note from yesterday
			const lastDailyNote = this.getLastDailyNote();
			if (lastDailyNote == null) return;

			// TODO: Rollover to subheadings (optional)
			//this.sortHeadersIntoHeirarchy(lastDailyNote)

			// get unfinished todos from yesterday, if exist
			let todos_yesterday = await this.getAllUnfinishedTodos(
				lastDailyNote
			);
			if (todos_yesterday.length == 0) {
				console.log(
					`rollover-daily-todos: 0 todos found in ${lastDailyNote.basename}.md`
				);
				return;
			}

			// setup undo history
			let undoHistoryInstance = {
				previousDay: {
					file: undefined,
					oldContent: "",
				},
				today: {
					file: undefined,
					oldContent: "",
				},
			};

			// Potentially filter todos from yesterday for today
			let todosAdded = 0;
			let emptiesToNotAddToTomorrow = 0;
			let todos_today = !removeEmptyTodos ? todos_yesterday : [];
			if (removeEmptyTodos) {
				todos_yesterday.forEach((line, i) => {
					const trimmedLine = (line || "").trim();
					if (trimmedLine != "- [ ]" && trimmedLine != "- [  ]") {
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
			let templateHeadingNotFoundMessage = "";
			const templateHeadingSelected = templateHeading !== "none";

			if (todos_today.length > 0) {
				let dailyNoteContent = await this.app.vault.read(file);
				undoHistoryInstance.today = {
					/* @ts-ignore */
					file: file,
					oldContent: `${dailyNoteContent}`,
				};
				const todos_todayString = `\n${todos_today.join("\n")}`;

				// If template heading is selected, try to rollover to template heading
				if (templateHeadingSelected) {
					const contentAddedToHeading = dailyNoteContent.replace(
						templateHeading,
						`${templateHeading}${todos_todayString}`
					);
					if (contentAddedToHeading == dailyNoteContent) {
						templateHeadingNotFoundMessage = `Rollover couldn't find '${templateHeading}' in today's daily not. Rolling todos to end of file.`;
					} else {
						dailyNoteContent = contentAddedToHeading;
					}
				}

				// Rollover to bottom of file if no heading found in file, or no heading selected
				if (
					!templateHeadingSelected ||
					templateHeadingNotFoundMessage.length > 0
				) {
					dailyNoteContent += todos_todayString;
				}

				await this.app.vault.modify(file, dailyNoteContent);
			}

			// if deleteOnComplete, get yesterday's content and modify it
			if (deleteOnComplete) {
				let lastDailyNoteContent = await this.app.vault.read(
					lastDailyNote
				);
				undoHistoryInstance.previousDay = {
					/* @ts-ignore */
					file: lastDailyNote,
					oldContent: `${lastDailyNoteContent}`,
				};
				let lines = lastDailyNoteContent.split("\n");

				for (let i = lines.length; i >= 0; i--) {
					if (todos_yesterday.includes(lines[i])) {
						lines.splice(i, 1);
					}
				}

				const modifiedContent = lines.join("\n");
				await this.app.vault.modify(lastDailyNote, modifiedContent);
			}

			// Let user know rollover has been successful with X todos
			const todosAddedString =
				todosAdded == 0
					? ""
					: `- ${todosAdded} todo${
							todosAdded > 1 ? "s" : ""
					  } rolled over.`;
			const emptiesToNotAddToTomorrowString =
				emptiesToNotAddToTomorrow == 0
					? ""
					: deleteOnComplete
					? `- ${emptiesToNotAddToTomorrow} empty todo${
							emptiesToNotAddToTomorrow > 1 ? "s" : ""
					  } removed.`
					: "";
			const part1 =
				templateHeadingNotFoundMessage.length > 0
					? `${templateHeadingNotFoundMessage}`
					: "";
			const part2 = `${todosAddedString}${
				todosAddedString.length > 0 ? " " : ""
			}`;
			const part3 = `${emptiesToNotAddToTomorrowString}${
				emptiesToNotAddToTomorrowString.length > 0 ? " " : ""
			}`;

			let allParts = [part1, part2, part3];
			let nonBlankLines: string[] = [];
			allParts.forEach((part) => {
				if (part.length > 0) {
					nonBlankLines.push(part);
				}
			});

			const message = nonBlankLines.join("\n");
			if (message.length > 0) {
				new Notice(message, 4000 + message.length * 3);
			}
			this.undoHistoryTime = new Date();
			this.undoHistory = [undoHistoryInstance];
		}
	}

	override async onload() {
		this.setupUI();
		this.setupCommands();
		this.app.workspace.onLayoutReady(async () => {
			await this.pluginDataIO.load();
			if (this.pluginDataIO.debug.value) {
				monkeyPatchConsole(this);
		}
			this.watchVault();
		})
	}

	private setupCommands() {
		this.addCommand({
			id: "obsidian-manager-sayHello",
			name: "Say Hello",
			callback: () => {
				this.sayHello();
				// TODO 读取配置，防止泄露密码
				axios
					.post(
						"https://ntfy.ihave.cool/test",
						"Look ma, with auth",
						{
							headers: {
								Authorization: "Basic xxx",
							},
						}
					)
					.then((res) => console.log(res));
			},
		});

		this.addCommand({
			id: "obsidian-manager-rollover",
			name: "Rollover Todos Now",
			callback: () => this.rollover(undefined),
		});

		this.addCommand({
			id: "obsidian-manager-undo",
			name: "Undo last rollover",
			checkCallback: (checking) => {
				// no history, don't allow undo
				if (this.undoHistory.length > 0) {
					const now = window.moment();
					const lastUse = window.moment(this.undoHistoryTime);
					const diff = now.diff(lastUse, "seconds");
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
		this.addSettingTab(new ReminderSettingTab(this.app, this));
		this.addRibbonIcon('dice', 'Sample Plugin', () => {
			new Notice('This is a notice!');
		});
		
	}

	private watchVault() {
		[
				this.app.vault.on('create', async (file) => {
					/* @ts-ignore */
					this.rollover(file);
				}),
				this.app.vault.on('modify', async (file) => {
						this.remindersController.reloadFile(file, true);
				}),
				this.app.vault.on('delete', (file) => {
					/* @ts-ignore */
						this.remindersController.removeFile(file.path);
				}),
				this.app.vault.on('rename', async (file, oldPath) => {
						// We only reload the file if it CAN be deleted, otherwise this can
						// cause crashes.
						/* @ts-ignore */
						if (await this.remindersController.removeFile(oldPath)) {
								// We need to do the reload synchronously so as to avoid racing.
								await this.remindersController.reloadFile(file);
						}
				}),
		].forEach((eventRef) => {
				this.registerEvent(eventRef);
		});
}
}
