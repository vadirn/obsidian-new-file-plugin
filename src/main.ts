import { App, Plugin, TFile, Notice, Menu, MarkdownView, Editor } from 'obsidian';

export default class NewFilePlugin extends Plugin {
    private checkCursorInWikilink(editor: Editor): string | null {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const linkMatch = line.match(/\[\[([^\]]+)\]\]/g);
        
        if (linkMatch) {
            for (const match of linkMatch) {
                const start = line.indexOf(match);
                const end = start + match.length;
                
                if (cursor.ch >= start && cursor.ch <= end) {
                    return match.slice(2, -2).split('|')[0];
                }
            }
        }
        return null;
    }

    async onload() {
        this.addCommand({
            id: 'create-file-with-frontmatter',
            name: 'Create file with frontmatter from cursor position',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                const linkText = this.checkCursorInWikilink(editor);
                if (linkText && view.file && !this.app.metadataCache.getFirstLinkpathDest(linkText, '')) {
                    this.createNewFileWithFrontMatter(view.file, linkText);
                }
            }
        });

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
                const linkText = this.checkCursorInWikilink(editor);
                if (linkText && view.file && !this.app.metadataCache.getFirstLinkpathDest(linkText, '')) {
                    this.addCreateFileMenuItem(menu, view.file, linkText);
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
