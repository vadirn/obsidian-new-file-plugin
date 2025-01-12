import { App, Plugin, TFile, Notice, Menu, MarkdownView, Editor } from 'obsidian';

export default class NewFilePlugin extends Plugin {
    private async handleWikilinkAtCursor(editor: Editor, view: MarkdownView, menu?: Menu): Promise<void> {
        const linkText = checkCursorInWikilink(editor);
        if (!linkText || !view.file || this.app.metadataCache.getFirstLinkpathDest(linkText, '')) {
            return;
        }

        if (!menu) {
            await this.createNewFileWithFrontMatter(view.file, linkText);
            return;
        }

        this.addCreateFileMenuItem(menu, view.file, linkText);
    }

    async onload() {
        this.addCommand({
            id: 'create-file-with-frontmatter',
            name: 'Create file with current frontmatter',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.handleWikilinkAtCursor(editor, view);
            }
        });

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
                this.handleWikilinkAtCursor(editor, view, menu);
            })
        );
    }

    private addCreateFileMenuItem(menu: Menu, file: TFile, newFileName?: string) {
        menu.addItem((item) => {
            item
                .setTitle('Create file with current frontmatter')
                .setIcon('document')
                .onClick(() => {
                    this.createNewFileWithFrontMatter(file, newFileName);
                });
        });
    }

    async createNewFileWithFrontMatter(file?: TFile, newFileName?: string) {
        const activeFile = await this.getActiveFile(file);
        if (!activeFile || !newFileName) {
            return;
        }

        try {
            const newFile = await this.createFile(activeFile, newFileName);
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(newFile);
            await leaf.setEphemeralState({ mode: 'source' });
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
        const frontMatter = await getFrontMatter(sourceFile, this.app.vault);
        const folderPath = sourceFile.parent?.path || '';
        const newFilePath = `${folderPath}/${fileName}.md`;
        
        return await this.app.vault.create(newFilePath, frontMatter);
    }
}

function checkCursorInWikilink(editor: Editor): string | null {
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
  
  async function getFrontMatter(file: TFile, vault: App['vault']): Promise<string> {
	try {
	    const content = await vault.read(file);
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