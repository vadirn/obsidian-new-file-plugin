import { App, Plugin, TFile, Notice, Menu, MarkdownView, Editor } from 'obsidian';

export default class NewFilePlugin extends Plugin {
    async onload() {
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
                this.addCreateFileMenuItem(menu, file);
            })
        );

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
                const selection = editor.getSelection();
                const linkMatch = selection.match(/\[\[([^\]]+)\]\]/);
                if (linkMatch) {
                    const linkText = linkMatch[1].split('|')[0];
                    const file = this.app.metadataCache.getFirstLinkpathDest(linkText, '');
                    if (!file && view.file) {
                        this.addCreateFileMenuItem(menu, view.file, linkText);
                    }
                }
            })
        );
    }

    private addCreateFileMenuItem(menu: Menu, file: TFile, newFileName?: string) {
        menu.addItem((item) => {
            item
                .setTitle('Create file with front matter')
                .setIcon('document')
                .onClick(() => {
                    this.createNewFileWithFrontMatter(file, newFileName);
                });
        });
    }

    async createNewFileWithFrontMatter(file?: TFile, newFileName?: string) {
        try {
            const activeFile = await this.getActiveFile(file);
            if (!activeFile || !newFileName) return;

            const newFile = await this.createFile(activeFile, newFileName);
            await this.openNewFile(newFile);

            new Notice(`Created new file: ${newFileName}`);
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
        return activeFile as TFile;
    }

    private async createFile(sourceFile: TFile, fileName: string): Promise<TFile> {
        const frontMatter = await this.getFrontMatter(sourceFile);
        const folderPath = sourceFile.parent?.path || '';
        const newFilePath = `${folderPath}/${fileName}.md`;
        
        return await this.app.vault.create(newFilePath, frontMatter);
    }

    private async openNewFile(file: TFile): Promise<void> {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
    }

    async getFrontMatter(file: TFile): Promise<string> {
        try {
            const content = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            
            if (!cache?.frontmatter) {
                return '---\n---\n';
            }

            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const match = content.match(frontmatterRegex);
            
            if (match) {
                return match[0] + '\n';
            }

            return '---\n---\n';
        } catch (error) {
            console.error('Error getting front matter:', error);
            return '---\n---\n';
        }
    }
}
