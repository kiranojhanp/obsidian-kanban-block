import { App, TFile, MarkdownPostProcessorContext } from "obsidian";
import { BoardConfig, CardData, KanbanColumn } from "../types";
import { BoardParser } from "./BoardParser";
import { QueryExecutor } from "./QueryExecutor";
import { ColumnRenderer } from "./ColumnRenderer";
import { CardManager } from "../card/CardManager";
import { Validator } from "../utils/validation";
import type KanbanBlockPlugin from "../main";

export class BoardView {
  app: App;
  plugin: KanbanBlockPlugin;
  boardFile: TFile;
  config: BoardConfig;
  container: HTMLElement;
  ctx: MarkdownPostProcessorContext;

  queryExecutor: QueryExecutor;
  columnRenderer: ColumnRenderer;
  cardManager: CardManager;

  cards: CardData[] = [];
  columns: KanbanColumn[] = [];

  constructor(
    app: App,
    plugin: KanbanBlockPlugin,
    boardFile: TFile,
    config: BoardConfig,
    container: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ) {
    this.app = app;
    this.plugin = plugin;
    this.boardFile = boardFile;
    this.config = config;
    this.container = container;
    this.ctx = ctx;

    this.queryExecutor = new QueryExecutor(app);
    this.columnRenderer = new ColumnRenderer(app);
    this.cardManager = new CardManager(app);
  }

  /**
   * Initialize and render board
   */
  async render(): Promise<void> {
    // Clear container
    this.container.empty();
    this.container.addClass("kb-board-wrapper");

    // Validate config
    const validation = Validator.validateBoardConfig(this.config);
    if (!validation.valid) {
      const errorEl = this.container.createDiv({ cls: "kb-error" });
      errorEl.createEl("strong", { text: "Board Configuration Error" });
      const errorList = errorEl.createEl("ul");
      validation.errors.forEach((error) => {
        errorList.createEl("li", { text: error });
      });
      return;
    }

    // Show loading
    const loadingEl = this.container.createDiv({ cls: "kb-loading" });
    loadingEl.textContent = "Loading cards...";

    try {
      // Load cards
      await this.loadCards();

      // Remove loading
      loadingEl.remove();

      // Render board
      this.renderBoard();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (loadingEl.parentElement) {
        loadingEl.textContent = `Error: ${errorMessage}`;
      } else {
        this.container.createDiv({
          cls: "kb-error",
          text: `Error: ${errorMessage}`,
        });
      }
      console.error("Board render error:", error);
    }
  }

  /**
   * Load cards from query
   */
  private async loadCards(): Promise<void> {
    // Get file content
    const content = await this.app.vault.read(this.boardFile);

    // Extract query
    let query = BoardParser.extractDataviewQuery(content);

    // Use default query if none specified
    if (!query) {
      query = BoardParser.getDefaultQuery(this.config.boardId);
    }

    // Execute query
    this.cards = await this.queryExecutor.executeQuery(
      query,
      this.boardFile.path
    );

    // Group cards by column
    this.groupCards();
  }

  /**
   * Group cards into columns
   */
  private groupCards(): void {
    this.columns = this.config.columns.map((columnConfig) => {
      const columnCards = this.cards.filter(
        (card) => card.metadata.status === columnConfig.status
      );

      return {
        config: columnConfig,
        cards: columnCards,
      };
    });
  }

  /**
   * Render the board
   */
  private renderBoard(): void {
    const boardEl = this.container.createDiv({ cls: "kb-board" });

    this.columns.forEach((column) => {
      this.columnRenderer.render(
        column.config,
        column.cards,
        boardEl,
        (card) => this.handleCardClick(card),
        (status) => this.handleAddCard(status)
      );
    });

    // Setup drag and drop
    this.setupDragAndDrop(boardEl);
  }

  /**
   * Handle card click
   */
  private handleCardClick(card: CardData): void {
    // Open card file
    const openMode = this.plugin.settings.openCardIn;

    if (openMode === "tab") {
      this.app.workspace.getLeaf(false).openFile(card.file.file);
    } else if (openMode === "split") {
      this.app.workspace.getLeaf("split").openFile(card.file.file);
    } else {
      this.app.workspace.getLeaf("window").openFile(card.file.file);
    }
  }

  /**
   * Handle add card
   */
  private async handleAddCard(status: string): Promise<void> {
    const folder = this.plugin.settings.defaultCardFolder;
    const template = this.plugin.settings.defaultCardTemplate;

    const file = await this.cardManager.createCard(folder, status, template);

    if (file) {
      // Open for editing
      await this.app.workspace.getLeaf(false).openFile(file);

      // Refresh board
      setTimeout(() => this.render(), 500);
    }
  }

  /**
   * Setup drag and drop
   */
  private setupDragAndDrop(boardEl: HTMLElement): void {
    let draggedCard: HTMLElement | null = null;
    let draggedCardPath: string | null = null;

    // Drag start
    boardEl.addEventListener("dragstart", (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("kb-card")) return;

      draggedCard = target;
      draggedCardPath = target.dataset["path"] || null;
      target.addClass("kb-dragging");
    });

    // Drag end
    boardEl.addEventListener("dragend", () => {
      if (draggedCard) {
        draggedCard.removeClass("kb-dragging");
      }
      draggedCard = null;
      draggedCardPath = null;
    });

    // Setup drop zones for each column
    const columns = boardEl.querySelectorAll(".kb-column-cards");
    columns.forEach((column) => {
      this.setupDropZone(column as HTMLElement);
    });
  }

  /**
   * Setup drop zone for column
   */
  private setupDropZone(columnEl: HTMLElement): void {
    columnEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      columnEl.addClass("kb-drag-over");
    });

    columnEl.addEventListener("dragleave", () => {
      columnEl.removeClass("kb-drag-over");
    });

    columnEl.addEventListener("drop", async (e) => {
      e.preventDefault();
      columnEl.removeClass("kb-drag-over");

      const targetStatus = columnEl.dataset["status"];

      // Use the dragged element's path from our tracking
      // (dataTransfer might be flaky in some environments)
      const draggingEl = document.querySelector(".kb-dragging") as HTMLElement;
      const cardPath = draggingEl?.dataset["path"];

      if (!targetStatus || !cardPath) return;

      // Update card status
      const file = this.app.vault.getAbstractFileByPath(cardPath);
      if (file instanceof TFile) {
        await this.cardManager.updateStatus(file, targetStatus);

        // Refresh board
        setTimeout(() => this.render(), 300);
      }
    });
  }

  /**
   * Refresh board
   */
  async refresh(): Promise<void> {
    await this.render();
  }
}
