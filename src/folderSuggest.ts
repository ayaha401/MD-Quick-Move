import { AbstractInputSuggest, App, TFolder } from "obsidian";

/**
 * 入力欄に Vault 内のフォルダパスの候補を表示する。
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);

		this.onSelect((folder) => {
			this.setValue(folder.path);
			// TextComponent の onChange に変更を伝える
			inputEl.trigger("input");
			this.close();
		});
	}

	protected getSuggestions(query: string): TFolder[] {
		const lowerQuery = query.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
			.filter((folder) => folder.path.toLowerCase().includes(lowerQuery))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}
}
