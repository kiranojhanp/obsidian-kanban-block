import { Plugin, MarkdownPostProcessorContext, TFile } from "obsidian";
import {
  KanbanBlockSettings,
  DEFAULT_SETTINGS,
  KanbanBlockSettingTab,
} from "./settings";
import { BoardParser } from "./board/BoardParser";
import { BoardView } from "./board/BoardView";
import { DataviewHelper } from "./utils/dataview";
import { BoardCommands } from "./commands/BoardCommands";

export default class KanbanBlockPlugin extends Plugin {
  settings: KanbanBlockSettings;
  dataviewHelper: DataviewHelper;
  boardCommands: BoardCommands;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new KanbanBlockSettingTab(this.app, this));

    this.dataviewHelper = new DataviewHelper(this.app);

    // Register commands
    this.boardCommands = new BoardCommands(this.app, this);
    this.boardCommands.register();

    // File-based kanban processor
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      await this.processKanbanBoard(el, ctx);
    });

    console.log("Kanban Block Plugin loaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Process file-based kanban boards
   */
  private async processKanbanBoard(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Check if Dataview is required and available
    if (this.settings.requireDataview && !this.dataviewHelper.isAvailable()) {
      return; // Silently skip if Dataview not available
    }

    // Get source file
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) return;

    // Check if file is a board file
    const cache = this.app.metadataCache.getFileCache(file);
    if (!BoardParser.isBoardFile(cache)) return;

    // Parse board config
    const config = BoardParser.parseBoardConfig(cache!);
    if (!config) return;

    // Create and render board view in the main content area
    const boardContainer = el.createDiv({ cls: "kb-board-container" });

    const boardView = new BoardView(
      this.app,
      this,
      file,
      config,
      boardContainer,
      ctx
    );

    await boardView.render();
  }
}
