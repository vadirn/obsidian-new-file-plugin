import { App, Plugin, PluginSettingTab, Setting, TFile, MarkdownView, Notice, Modal } from 'obsidian';

interface NewFilePluginSettings {
    defaultFolder: string;
}

const DEFAULT_SETTINGS: NewFilePluginSettings = {
    defaultFolder: ''
}

export default class NewFilePlugin extends Plugin {
    settings: NewFilePluginSettings;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new NewFileSettingTab(this.app, this));

        this.addCommand({
            id: 'create-new-file-with-front-matter',
            name: 'Create new file with copied front matter',
            callback: () => this.createNewFileWithFrontMatter()
        });

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
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
            })
        );

        this.registerDomEvent(
            document, 'click', (event: MouseEvent) => {
                const target = event.target as HTMLElement;
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
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async createNewFileWithFrontMatter(file?: TFile, newFileName?: string) {
        try {
            const activeFile = await this.getActiveFile(file);
            if (!activeFile) return;

            const fileName = await this.determineFileName(newFileName);
            if (!fileName) return;

            const newFile = await this.createFile(activeFile, fileName);
            await this.openNewFile(newFile);

            new Notice(`Created new file: ${fileName}`);
        } catch (error) {
            console.error('Error creating new file:', error);
            new Notice('Error creating new file. Check console for details.');
        }
    }

    private async getActiveFile(file?: TFile): Promise<TFile | null> {
        const activeFile = file || this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return null;
        }
        return activeFile;
    }

    private async determineFileName(newFileName?: string): Promise<string | undefined> {
        if (!newFileName) {
            return await this.getNewFileName();
        }
        return newFileName;
    }

    private async createFile(sourceFile: TFile, fileName: string): Promise<TFile> {
        const frontMatter = await this.getFrontMatter(sourceFile);
        const folderPath = this.settings.defaultFolder || sourceFile.parent?.path || '';
        const newFilePath = `${folderPath}/${fileName}.md`;
        
        return await this.app.vault.create(newFilePath, frontMatter);
    }

    private async openNewFile(file: TFile): Promise<void> {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
    }

    async getFrontMatter(file: TFile): Promise<string> {
        try {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter) {
                const { position } = cache.frontmatter;
                const content = await this.app.vault.read(file);
                return content.slice(0, position.end.offset);
            }
            return '---\n---\n';
        } catch (error) {
            console.error('Error getting front matter:', error);
            return '---\n---\n';
        }
    }

    async getNewFileName(): Promise<string | undefined> {
        return new Promise((resolve) => {
            const modal = new NewFileModal(this.app, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }
}

class NewFileModal extends Modal {
    result: string;
    onSubmit: (result: string | undefined) => void;

    constructor(app: App, onSubmit: (result: string | undefined) => void) {
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
        } else {
            this.onSubmit(undefined);
        }
    }
}

class NewFileSettingTab extends PluginSettingTab {
    plugin: NewFilePlugin;

    constructor(app: App, plugin: NewFilePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'New File Plugin Settings' });

        new Setting(containerEl)
            .setName('Default folder for new files')
            .setDesc('Set the default folder where new files will be created')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.defaultFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
