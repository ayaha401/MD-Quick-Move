import { App, PluginSettingTab, Setting, TFolder, normalizePath } from "obsidian";
import type MDQuickMovePlugin from "./main";
import { FolderSuggest } from "./folderSuggest";

export interface MoveTarget {
	/** メニューに表示する名前 */
	name: string;
	/** 移動先フォルダのパス */
	path: string;
}

export interface MDQuickMoveSettings {
	targets: MoveTarget[];
}

export const DEFAULT_SETTINGS: MDQuickMoveSettings = {
	targets: [],
};

/**
 * 表示名とパスがどちらも入力されている移動先だけを返す。
 */
export function getValidTargets(settings: MDQuickMoveSettings): MoveTarget[] {
	return settings.targets.filter((target) => target.name.trim() !== "" && target.path.trim() !== "");
}

export class MDQuickMoveSettingTab extends PluginSettingTab {
	plugin: MDQuickMovePlugin;

	constructor(app: App, plugin: MDQuickMovePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("移動先")
			.setDesc("ボタンを押したときのメニューに、ここで登録した順に表示されます。")
			.setHeading();

		this.plugin.settings.targets.forEach((target, index) => {
			this.addTargetSetting(containerEl, target, index);
		});

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("追加")
				.setCta()
				.onClick(async () => {
					this.plugin.settings.targets.push({ name: "", path: "" });
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	private addTargetSetting(containerEl: HTMLElement, target: MoveTarget, index: number): void {
		const targets = this.plugin.settings.targets;
		const setting = new Setting(containerEl).setName(`${index + 1}`);
		setting.settingEl.addClass("md-quick-move-target");

		const nameWarningEl = setting.descEl.createDiv({ cls: "md-quick-move-warning" });
		const pathWarningEl = setting.descEl.createDiv({ cls: "md-quick-move-warning" });

		const updateNameWarning = (name: string): boolean => {
			const trimmed = name.trim();
			const isDuplicate = trimmed !== "" && this.isDuplicateName(trimmed, index);
			nameWarningEl.setText(isDuplicate ? `表示名「${trimmed}」は既に登録されているため保存されません` : "");
			return isDuplicate;
		};

		const updatePathWarning = (path: string): void => {
			const trimmed = path.trim();
			const exists = trimmed === "" || this.app.vault.getAbstractFileByPath(normalizePath(trimmed)) instanceof TFolder;
			pathWarningEl.setText(exists ? "" : `フォルダ「${trimmed}」が存在しません`);
		};

		setting.addText((text) => {
			text.inputEl.addClass("md-quick-move-name-input");
			text
				.setPlaceholder("表示名")
				.setValue(target.name)
				.onChange(async (value) => {
					if (updateNameWarning(value)) {
						return;
					}
					target.name = value;
					await this.plugin.saveSettings();
				});
		});

		setting.addText((text) => {
			text.inputEl.addClass("md-quick-move-path-input");
			new FolderSuggest(this.app, text.inputEl);
			text
				.setPlaceholder("フォルダパス（例：Folder/SubFolder）")
				.setValue(target.path)
				.onChange(async (value) => {
					target.path = value;
					updatePathWarning(value);
					await this.plugin.saveSettings();
				});
		});

		setting.addExtraButton((button) =>
			button
				.setIcon("arrow-up")
				.setTooltip("上へ")
				.setDisabled(index === 0)
				.onClick(async () => {
					if (index === 0) return;
					[targets[index - 1], targets[index]] = [targets[index], targets[index - 1]];
					await this.plugin.saveSettings();
					this.display();
				})
		);

		setting.addExtraButton((button) =>
			button
				.setIcon("arrow-down")
				.setTooltip("下へ")
				.setDisabled(index === targets.length - 1)
				.onClick(async () => {
					if (index === targets.length - 1) return;
					[targets[index], targets[index + 1]] = [targets[index + 1], targets[index]];
					await this.plugin.saveSettings();
					this.display();
				})
		);

		setting.addExtraButton((button) =>
			button
				.setIcon("trash")
				.setTooltip("削除")
				.onClick(async () => {
					targets.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				})
		);

		updateNameWarning(target.name);
		updatePathWarning(target.path);
	}

	/**
	 * 自分以外の移動先に同じ表示名があるかを調べる。前後の空白は無視し、大文字小文字は区別する。
	 */
	private isDuplicateName(name: string, selfIndex: number): boolean {
		return this.plugin.settings.targets.some(
			(target, index) => index !== selfIndex && target.name.trim() === name
		);
	}
}
