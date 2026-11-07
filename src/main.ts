import { FileView, Menu, Notice, Plugin, TFile, TFolder, WorkspaceLeaf, normalizePath } from "obsidian";
import {
	DEFAULT_SETTINGS,
	MDQuickMoveSettingTab,
	getValidTargets,
	type MDQuickMoveSettings,
	type MoveTarget,
} from "./settings";

const ACTION_ICON = "folder-input";
const ACTION_TITLE = "フォルダへ移動";
const ACTION_CLASS = "md-quick-move-action";

export default class MDQuickMovePlugin extends Plugin {
	settings: MDQuickMoveSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new MDQuickMoveSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.addActionsToAllViews());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.addActionsToAllViews()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.addActionsToAllViews()));
	}

	onunload(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			leaf.view.containerEl.querySelectorAll(`.${ACTION_CLASS}`).forEach((el) => el.remove());
		});
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<MDQuickMoveSettings> | null;
		this.settings = {
			targets: (data?.targets ?? DEFAULT_SETTINGS.targets).map((target) => ({
				name: target.name ?? "",
				path: target.path ?? "",
			})),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private addActionsToAllViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => this.addAction(leaf));
	}

	/**
	 * ファイルを表示しているビューの右上に移動ボタンを追加する。追加済みなら何もしない。
	 */
	private addAction(leaf: WorkspaceLeaf): void {
		const view = leaf.view;
		if (!(view instanceof FileView)) return;
		if (view.containerEl.querySelector(`.${ACTION_CLASS}`)) return;

		const actionEl = view.addAction(ACTION_ICON, ACTION_TITLE, (evt) => this.openMenu(view, evt));
		actionEl.addClass(ACTION_CLASS);
	}

	private openMenu(view: FileView, evt: MouseEvent): void {
		const file = view.file;
		if (!file) {
			new Notice("移動するファイルが開かれていません");
			return;
		}

		const menu = new Menu();
		const targets = getValidTargets(this.settings);
		const currentFolder = file.parent?.path ?? "/";

		if (targets.length === 0) {
			menu.addItem((item) => item.setTitle("移動先が登録されていません").setDisabled(true));
		}

		for (const target of targets) {
			const isCurrent = normalizePath(target.path.trim()) === currentFolder;
			menu.addItem((item) =>
				item
					.setTitle(target.name.trim())
					.setDisabled(isCurrent)
					.onClick(() => {
						if (isCurrent) return;
						void this.moveFile(file, target);
					})
			);
		}

		menu.showAtMouseEvent(evt);
	}

	private async moveFile(file: TFile, target: MoveTarget): Promise<void> {
		const name = target.name.trim();
		const folderPath = normalizePath(target.path.trim());
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			new Notice(`移動先フォルダ「${folderPath}」が存在しません`);
			return;
		}
		if (file.parent?.path === folder.path) return;

		const newPath = folder.isRoot() ? file.name : `${folder.path}/${file.name}`;
		const alreadyExists =
			this.app.vault.getAbstractFileByPath(newPath) !== null || (await this.app.vault.adapter.exists(newPath));
		if (alreadyExists) {
			new Notice(`「${name}」に同じ名前のファイル「${file.name}」があるため、移動を中止しました`);
			return;
		}

		try {
			await this.app.fileManager.renameFile(file, newPath);
			new Notice(`「${file.name}」を「${name}」へ移動しました`);
		} catch (error) {
			console.error("[MD-Quick-Move]", error);
			new Notice(`移動に失敗しました：${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
