import { __awaiter } from "tslib";
import { Plugin, PluginSettingTab, Setting, TFile, Notice, Modal } from 'obsidian';
const DEFAULT_SETTINGS = {
    defaultFolder: ''
};
export default class NewFilePlugin extends Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.addSettingTab(new NewFileSettingTab(this.app, this));
            this.addCommand({
                id: 'create-new-file-with-front-matter',
                name: 'Create new file with copied front matter',
                callback: () => this.createNewFileWithFrontMatter()
            });
            this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
                menu.addItem((item) => {
                    item
                        .setTitle('Create new file with copied front matter')
                        .setIcon('document')
                        .onClick(() => {
                        if (file instanceof TFile) {
                            this.createNewFileWithFrontMatter(file);
                        }
                    });
                });
            }));
            this.registerDomEvent(document, 'click', (event) => {
                const target = event.target;
                if (target.classList.contains('internal-link')) {
                    const href = target.getAttribute('href');
                    if (href) {
                        const file = this.app.metadataCache.getFirstLinkpathDest(href, '');
                        if (!file) {
                            event.preventDefault();
                            this.createNewFileWithFrontMatter(undefined, href);
                        }
                    }
                }
            });
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    createNewFileWithFrontMatter(file, newFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeFile = yield this.getActiveFile(file);
                if (!activeFile)
                    return;
                const fileName = yield this.determineFileName(newFileName);
                if (!fileName)
                    return;
                const newFile = yield this.createFile(activeFile, fileName);
                yield this.openNewFile(newFile);
                new Notice(`Created new file: ${fileName}`);
            }
            catch (error) {
                console.error('Error creating new file:', error);
                new Notice('Error creating new file. Check console for details.');
            }
        });
    }
    getActiveFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeFile = file || this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('No active file');
                return null;
            }
            return activeFile;
        });
    }
    determineFileName(newFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!newFileName) {
                return yield this.getNewFileName();
            }
            return newFileName;
        });
    }
    createFile(sourceFile, fileName) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const frontMatter = yield this.getFrontMatter(sourceFile);
            const folderPath = this.settings.defaultFolder || ((_a = sourceFile.parent) === null || _a === void 0 ? void 0 : _a.path) || '';
            const newFilePath = `${folderPath}/${fileName}.md`;
            return yield this.app.vault.create(newFilePath, frontMatter);
        });
    }
    openNewFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const leaf = this.app.workspace.getLeaf(false);
            yield leaf.openFile(file);
        });
    }
    getFrontMatter(file) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cache = this.app.metadataCache.getFileCache(file);
                if (cache === null || cache === void 0 ? void 0 : cache.frontmatter) {
                    const { position } = cache.frontmatter;
                    const content = yield this.app.vault.read(file);
                    return content.slice(0, position.end.offset);
                }
                return '---\n---\n';
            }
            catch (error) {
                console.error('Error getting front matter:', error);
                return '---\n---\n';
            }
        });
    }
    getNewFileName() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const modal = new NewFileModal(this.app, (result) => {
                    resolve(result);
                });
                modal.open();
            });
        });
    }
}
class NewFileModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Enter new file name' });
        const inputEl = contentEl.createEl('input', { type: 'text' });
        inputEl.focus();
        const submitButton = contentEl.createEl('button', { text: 'Create' });
        submitButton.onclick = () => {
            this.result = inputEl.value;
            this.close();
        };
        inputEl.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.result = inputEl.value;
                this.close();
            }
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.result) {
            this.onSubmit(this.result);
        }
        else {
            this.onSubmit(undefined);
        }
    }
}
class NewFileSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'New File Plugin Settings' });
        new Setting(containerEl)
            .setName('Default folder for new files')
            .setDesc('Set the default folder where new files will be created')
            .addText(text => text
            .setPlaceholder('Enter folder path')
            .setValue(this.plugin.settings.defaultFolder)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.defaultFolder = value;
            yield this.plugin.saveSettings();
        })));
    }
}
