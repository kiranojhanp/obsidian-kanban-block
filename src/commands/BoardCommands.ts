import { App, Notice, TFile, Modal, Setting } from "obsidian";
import type KanbanBlockPlugin from "../main";

export class BoardCommands {
  app: App;
  plugin: KanbanBlockPlugin;

  constructor(app: App, plugin: KanbanBlockPlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Register all commands
   */
  register(): void {
    // Create new board
    this.plugin.addCommand({
      id: "create-kanban-board",
      name: "Create new Kanban board",
      callback: () => this.createBoard(),
    });

    // Create card in current board
    this.plugin.addCommand({
      id: "create-card",
      name: "Create new card",
      callback: () => this.createCard(),
    });
  }

  /**
   * Create a new board file
   */
  private async createBoard(): Promise<void> {
    const boardName = await this.promptForName(
      "Board name",
      "My Project Board"
    );
    if (!boardName) return;

    const boardId = boardName.toLowerCase().replace(/\s+/g, "-");
    const filename = `${boardName}.md`;

    const content = this.getBoardTemplate(boardName, boardId);

    try {
      const file = await this.app.vault.create(filename, content);
      await this.app.workspace.getLeaf(false).openFile(file);
      new Notice("Board created!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to create board: ${errorMessage}`);
    }
  }

  /**
   * Create a new card
   */
  private async createCard(): Promise<void> {
    // Get active board file
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("No active file");
      return;
    }

    // Check if it's a board file
    const cache = this.app.metadataCache.getFileCache(activeFile);
    if (!cache?.frontmatter || cache.frontmatter.type !== "kanban-board") {
      new Notice("Active file is not a kanban board");
      return;
    }

    // Get board ID and first column status
    const boardId = cache.frontmatter["board-id"] || "";
    const firstColumnStatus = cache.frontmatter.columns?.[0]?.status || "todo";

    // Create card
    const folder = this.plugin.settings.defaultCardFolder;
    const template = this.plugin.settings.defaultCardTemplate;

    const cardName = await this.promptForName("Card title", "New Card");
    if (!cardName) return;

    try {
      const file = await this.createCardFile(
        folder,
        cardName,
        firstColumnStatus,
        boardId,
        template
      );
      await this.app.workspace.getLeaf("split").openFile(file);
      new Notice("Card created!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to create card: ${errorMessage}`);
    }
  }

  /**
   * Get board template
   */
  private getBoardTemplate(name: string, boardId: string): string {
    const columns = this.plugin.settings.defaultColumns;

    return `---
type: kanban-board
board-id: ${boardId}
columns: 
${columns
  .map(
    (col) =>
      `  - name: ${col.name}\n    status: ${col.status}\n    color: "${col.color}"`
  )
  .join("\n")}
---

# ${name}

\`\`\`dataviewjs
// Query cards for this board
const cards = dv.pages()
  .where(p => p.board === "${boardId}" && p.status)
  .sort(p => p.priority);

return cards;
\`\`\`

<!-- Board will render above in reading view -->
`;
  }

  /**
   * Create card file
   */
  private async createCardFile(
    folder: string,
    name: string,
    status: string,
    boardId: string,
    templatePath?: string
  ): Promise<TFile> {
    // Ensure folder exists
    await this.ensureFolder(folder);

    // Generate filename
    const sanitized = name.replace(/[\\/:*?"<>|]/g, "-");
    const filename = `${folder}/${sanitized}.md`;

    // Get template
    let content = templatePath
      ? await this.getTemplate(templatePath)
      : this.getDefaultCardTemplate();

    // Replace placeholders
    const dateStr = new Date().toISOString().split("T")[0] || "";
    content = content
      .replace(/{{title}}/g, name)
      .replace(/{{status}}/g, status)
      .replace(/{{board}}/g, boardId)
      .replace(/{{date}}/g, dateStr);

    // Create file
    return await this.app.vault.create(filename, content);
  }

  /**
   * Get default card template
   */
  private getDefaultCardTemplate(): string {
    return `---
status: {{status}}
board: {{board}}
created: {{date}}
priority: medium
---

# {{title}}

## Description


## Tasks
- [ ] 

## Notes

`;
  }

  /**
   * Get template from file
   */
  private async getTemplate(path: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return await this.app.vault.read(file);
    }
    return this.getDefaultCardTemplate();
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolder(path: string): Promise<void> {
    const folders = path.split("/");
    let current = "";

    for (const folder of folders) {
      current += (current ? "/" : "") + folder;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  /**
   * Prompt for name
   */
  private async promptForName(
    title: string,
    placeholder: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new NameInputModal(this.app, title, placeholder, resolve);
      modal.open();
    });
  }
}

class NameInputModal extends Modal {
  result: string = "";
  onSubmit: (result: string | null) => void;
  title: string;
  placeholder: string;

  constructor(
    app: App,
    title: string,
    placeholder: string,
    onSubmit: (result: string | null) => void
  ) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });

    new Setting(contentEl).setName("Name").addText((text) => {
      text
        .setPlaceholder(this.placeholder)
        .onChange((value) => (this.result = value));
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.close();
          this.onSubmit(this.result || null);
        }
      });
      setTimeout(() => text.inputEl.focus(), 10);
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Create")
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit(this.result || null);
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.close();
          this.onSubmit(null);
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
