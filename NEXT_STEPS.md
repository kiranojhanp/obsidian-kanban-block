# 📋 Step-by-Step Implementation Plan for File-Based Kanban

## Overview

Refactor `obsidian-kanban-block` to support:

- **1 card = 1 file** (full Obsidian features)
- **DataviewJS queries** for card aggregation
- **Board files** with frontmatter configuration
- **Drag & drop** updates frontmatter
- **Backward compatibility** with existing `todo` blocks

---

## 🎯 Phase 1: Foundation & Types (Steps 1-3)

### **STEP 1: Update Type Definitions**

**File:** `src/types.ts`

**Action:** Extend existing types and add new ones for file-based cards.

```typescript
// KEEP existing types for backward compatibility
export type TodoState = "todo" | "in-progress" | "done";

export interface TodoItem {
  id: string;
  text: string;
  state: TodoState;
  originalMarker: string;
  children: string[];
}

// ADD NEW TYPES for file-based kanban
export interface BoardConfig {
  type: "kanban-board";
  boardId: string;
  columns: ColumnConfig[];
  cardTemplate?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface ColumnConfig {
  name: string;
  status: string; // The value that will be set in card frontmatter
  color?: string;
  limit?: number; // WIP limit (optional)
  collapsed?: boolean;
}

export interface CardFile {
  file: TFile; // Obsidian's TFile type
  path: string;
  name: string;
}

export interface CardMetadata {
  status: string;
  priority?: "high" | "medium" | "low";
  due?: string;
  assignee?: string | TFile;
  board?: string;
  tags?: string[];
  [key: string]: any; // Allow custom fields
}

export interface CardData {
  file: CardFile;
  metadata: CardMetadata;
  title: string;
  content: string;
}

export interface KanbanColumn {
  config: ColumnConfig;
  cards: CardData[];
}

export interface DataviewQueryResult {
  successful: boolean;
  value?: any;
  error?: string;
}
```

**Success Criteria:**

- File compiles without errors
- Existing code still works (TodoItem, etc.)
- New types are available for import

---

### **STEP 2: Create Settings Structure**

**File:** `src/settings.ts`

**Action:** Extend existing settings to support new features.

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import type KanbanBlockPlugin from "./main";

// KEEP existing settings
export interface KanbanBlockSettings {
  // Legacy settings (for todo blocks)
  columnNames: {
    todo: string;
    inProgress: string;
    done: string;
  };
  centerBoard: boolean;

  // NEW:  File-based kanban settings
  enableFileBased: boolean;
  defaultCardFolder: string;
  defaultCardTemplate: string;
  requireDataview: boolean;
  openCardIn: "tab" | "split" | "window";
  cardWidth: number;
  showCardCount: boolean;
  maintainCardOrder: boolean;

  // Default columns for new boards
  defaultColumns: Array<{
    name: string;
    status: string;
    color: string;
  }>;
}

export const DEFAULT_SETTINGS: KanbanBlockSettings = {
  // Legacy defaults
  columnNames: {
    todo: "To do",
    inProgress: "In progress",
    done: "Done",
  },
  centerBoard: false,

  // NEW defaults
  enableFileBased: true,
  defaultCardFolder: "Cards",
  defaultCardTemplate: "",
  requireDataview: true,
  openCardIn: "tab",
  cardWidth: 280,
  showCardCount: true,
  maintainCardOrder: false,

  defaultColumns: [
    { name: "📋 To Do", status: "todo", color: "#94a3b8" },
    { name: "🚧 In Progress", status: "in-progress", color: "#3b82f6" },
    { name: "✅ Done", status: "done", color: "#22c55e" },
  ],
};

// EXTEND existing settings tab
export class KanbanBlockSettingTab extends PluginSettingTab {
  plugin: KanbanBlockPlugin;

  constructor(app: App, plugin: KanbanBlockPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // NEW: File-based kanban section
    new Setting(containerEl)
      .setName("Enable file-based kanban")
      .setDesc("Use files as cards with DataviewJS queries")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFileBased)
          .onChange(async (value) => {
            this.plugin.settings.enableFileBased = value;
            await this.plugin.saveSettings();
            this.display(); // Re-render to show/hide options
          })
      );

    if (this.plugin.settings.enableFileBased) {
      new Setting(containerEl)
        .setName("Default card folder")
        .setDesc("Where to create new cards")
        .addText((text) =>
          text
            .setPlaceholder("Cards")
            .setValue(this.plugin.settings.defaultCardFolder)
            .onChange(async (value) => {
              this.plugin.settings.defaultCardFolder = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Default card template")
        .setDesc("Path to template file for new cards")
        .addText((text) =>
          text
            .setPlaceholder("Templates/Card.md")
            .setValue(this.plugin.settings.defaultCardTemplate)
            .onChange(async (value) => {
              this.plugin.settings.defaultCardTemplate = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Open cards in")
        .setDesc("How to open card files when clicked")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("tab", "New tab")
            .addOption("split", "Split pane")
            .addOption("window", "New window")
            .setValue(this.plugin.settings.openCardIn)
            .onChange(async (value) => {
              this.plugin.settings.openCardIn = value as any;
              await this.plugin.saveSettings();
            })
        );
    }

    // KEEP existing settings (for legacy todo blocks)
    containerEl.createEl("h3", { text: "Legacy Code Block Settings" });

    new Setting(containerEl)
      .setName("To do column")
      .setDesc("Name for the first column (todo blocks)")
      .addText((text) =>
        text
          .setPlaceholder("To do")
          .setValue(this.plugin.settings.columnNames.todo)
          .onChange(async (value) => {
            this.plugin.settings.columnNames.todo = value || "To do";
            await this.plugin.saveSettings();
          })
      );

    // ...  (keep rest of existing settings)
  }
}
```

**Success Criteria:**

- Settings tab shows new options when `enableFileBased` is true
- Existing settings still work
- Settings save/load properly

---

### **STEP 3: Create Utility Modules**

**File:** `src/utils/dataview.ts` (NEW)

**Action:** Create DataviewJS integration utilities.

```typescript
import { App } from "obsidian";
import { DataviewQueryResult } from "../types";

export class DataviewHelper {
  app: App;
  dataviewAPI: any;

  constructor(app: App) {
    this.app = app;
    this.dataviewAPI = this.getDataviewAPI();
  }

  /**
   * Get Dataview API if plugin is installed
   */
  private getDataviewAPI(): any {
    const dataview = (this.app as any).plugins?.plugins?.dataview;
    return dataview?.api;
  }

  /**
   * Check if Dataview is available
   */
  isAvailable(): boolean {
    return this.dataviewAPI !== undefined;
  }

  /**
   * Execute a DataviewJS query and return results
   */
  async executeQuery(
    query: string,
    sourcePath: string
  ): Promise<DataviewQueryResult> {
    if (!this.isAvailable()) {
      return {
        successful: false,
        error: "Dataview plugin is not installed or enabled",
      };
    }

    try {
      // Create a minimal context for query execution
      const context = {
        app: this.app,
        dv: this.dataviewAPI,
        container: document.createElement("div"),
        sourcePath: sourcePath,
      };

      // Execute the query
      const func = new Function("dv", `return (${query})`);
      const result = await func(this.dataviewAPI);

      return {
        successful: true,
        value: result,
      };
    } catch (error) {
      return {
        successful: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse Dataview page results to file list
   */
  parsePageResults(result: any): string[] {
    if (!result) return [];

    // Handle different Dataview result types
    if (Array.isArray(result)) {
      return result
        .map((item) => {
          if (typeof item === "string") return item;
          if (item.file?.path) return item.file.path;
          if (item.path) return item.path;
          return null;
        })
        .filter(Boolean);
    }

    if (result.values) {
      return this.parsePageResults(result.values);
    }

    return [];
  }
}
```

**File:** `src/utils/frontmatter.ts` (NEW)

**Action:** Create frontmatter parsing utilities.

```typescript
import { App, TFile, CachedMetadata } from "obsidian";
import { CardMetadata } from "../types";

export class FrontmatterHelper {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Read card metadata from file frontmatter
   */
  getCardMetadata(file: TFile): CardMetadata | null {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return null;

    return {
      status: cache.frontmatter.status,
      priority: cache.frontmatter.priority,
      due: cache.frontmatter.due,
      assignee: cache.frontmatter.assignee,
      board: cache.frontmatter.board,
      tags: cache.frontmatter.tags || [],
      ...cache.frontmatter, // Include all custom fields
    };
  }

  /**
   * Update card status in frontmatter
   */
  async updateCardStatus(file: TFile, newStatus: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.status = newStatus;
      frontmatter["last-updated"] = new Date().toISOString();
    });
  }

  /**
   * Update any frontmatter field
   */
  async updateCardMetadata(
    file: TFile,
    updates: Partial<CardMetadata>
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      Object.assign(frontmatter, updates);
      frontmatter["last-updated"] = new Date().toISOString();
    });
  }

  /**
   * Parse board configuration from frontmatter
   */
  getBoardConfig(cache: CachedMetadata): any {
    if (!cache?.frontmatter) return null;
    if (cache.frontmatter.type !== "kanban-board") return null;

    return {
      type: "kanban-board",
      boardId: cache.frontmatter["board-id"] || "",
      columns: cache.frontmatter.columns || [],
      cardTemplate: cache.frontmatter["card-template"],
      autoRefresh: cache.frontmatter["auto-refresh"] ?? true,
      refreshInterval: cache.frontmatter["refresh-interval"] ?? 30,
    };
  }
}
```

**Success Criteria:**

- DataviewHelper can detect Dataview plugin
- FrontmatterHelper can read/write frontmatter
- No errors when Dataview is not installed

---

## 🎯 Phase 2: Board Configuration & Parsing (Steps 4-6)

### **STEP 4: Create Board Parser**

**File:** `src/board/BoardParser.ts` (NEW)

**Action:** Parse board files and extract configuration + query.

````typescript
import { TFile, CachedMetadata } from "obsidian";
import { BoardConfig, ColumnConfig } from "../types";

export class BoardParser {
  /**
   * Check if file is a kanban board
   */
  static isBoardFile(cache: CachedMetadata | null): boolean {
    return cache?.frontmatter?.type === "kanban-board";
  }

  /**
   * Parse board configuration from frontmatter
   */
  static parseBoardConfig(cache: CachedMetadata): BoardConfig | null {
    if (!this.isBoardFile(cache)) return null;

    const fm = cache.frontmatter!;

    // Parse columns
    const columns: ColumnConfig[] = (fm.columns || []).map((col: any) => ({
      name: col.name || "Unnamed",
      status: col.status || "",
      color: col.color,
      limit: col.limit,
      collapsed: col.collapsed ?? false,
    }));

    return {
      type: "kanban-board",
      boardId: fm["board-id"] || "",
      columns: columns,
      cardTemplate: fm["card-template"],
      autoRefresh: fm["auto-refresh"] ?? true,
      refreshInterval: fm["refresh-interval"] ?? 30,
    };
  }

  /**
   * Extract DataviewJS query from file content
   */
  static extractDataviewQuery(content: string): string | null {
    // Match ```dataviewjs ...  ```
    const regex = /```dataviewjs\s*\n([\s\S]*?)```/;
    const match = content.match(regex);

    if (!match || !match[1]) return null;

    return match[1].trim();
  }

  /**
   * Get default query if none specified
   */
  static getDefaultQuery(boardId: string): string {
    return `dv.pages().where(p => p.board === "${boardId}" && p.status)`;
  }
}
````

**Success Criteria:**

- Can detect board files by frontmatter
- Can extract column configuration
- Can extract DataviewJS code block
- Has fallback for missing query

---

### **STEP 5: Create Card Data Manager**

**File:** `src/card/CardManager.ts` (NEW)

**Action:** Manage card file operations.

```typescript
import { App, TFile, TFolder, Notice } from "obsidian";
import { CardData, CardMetadata } from "../types";
import { FrontmatterHelper } from "../utils/frontmatter";

export class CardManager {
  app: App;
  frontmatterHelper: FrontmatterHelper;

  constructor(app: App) {
    this.app = app;
    this.frontmatterHelper = new FrontmatterHelper(app);
  }

  /**
   * Load card data from file
   */
  async loadCard(file: TFile): Promise<CardData | null> {
    const metadata = this.frontmatterHelper.getCardMetadata(file);
    if (!metadata) return null;

    const content = await this.app.vault.read(file);
    const title = this.extractTitle(content) || file.basename;

    return {
      file: {
        file: file,
        path: file.path,
        name: file.basename,
      },
      metadata: metadata,
      title: title,
      content: content,
    };
  }

  /**
   * Load multiple cards
   */
  async loadCards(files: TFile[]): Promise<CardData[]> {
    const cards: CardData[] = [];

    for (const file of files) {
      const card = await this.loadCard(file);
      if (card) cards.push(card);
    }

    return cards;
  }

  /**
   * Extract title from content (first heading or filename)
   */
  private extractTitle(content: string): string | null {
    // Remove frontmatter
    const withoutFrontmatter = content.replace(
      /^---\s*\n[\s\S]*?\n---\s*\n/,
      ""
    );

    // Find first heading
    const match = withoutFrontmatter.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
  }

  /**
   * Create new card file
   */
  async createCard(
    folder: string,
    status: string,
    templatePath?: string
  ): Promise<TFile | null> {
    try {
      // Ensure folder exists
      await this.ensureFolder(folder);

      // Generate filename
      const filename = `${folder}/Card ${Date.now()}.md`;

      // Get template content
      let content = await this.getTemplateContent(templatePath);

      // Set initial frontmatter
      content = this.setInitialFrontmatter(content, status);

      // Create file
      const file = await this.app.vault.create(filename, content);

      new Notice("Card created");
      return file;
    } catch (error) {
      new Notice(`Failed to create card: ${error.message}`);
      return null;
    }
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolder(path: string): Promise<void> {
    const folders = path.split("/");
    let currentPath = "";

    for (const folder of folders) {
      currentPath += (currentPath ? "/" : "") + folder;

      if (!this.app.vault.getAbstractFileByPath(currentPath)) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  /**
   * Get template content
   */
  private async getTemplateContent(templatePath?: string): Promise<string> {
    if (!templatePath) {
      return `---\nstatus: \n---\n\n# New Card\n\n`;
    }

    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (templateFile instanceof TFile) {
      return await this.app.vault.read(templateFile);
    }

    return `---\nstatus: \n---\n\n# New Card\n\n`;
  }

  /**
   * Set initial frontmatter values
   */
  private setInitialFrontmatter(content: string, status: string): string {
    // If content has frontmatter, update it
    if (content.startsWith("---")) {
      return content.replace(
        /^---\s*\n/,
        `---\nstatus: ${status}\ncreated: ${new Date().toISOString()}\n`
      );
    }

    // Otherwise, prepend frontmatter
    return `---\nstatus: ${status}\ncreated: ${new Date().toISOString()}\n---\n\n${content}`;
  }

  /**
   * Update card status
   */
  async updateStatus(file: TFile, newStatus: string): Promise<void> {
    await this.frontmatterHelper.updateCardStatus(file, newStatus);
  }
}
```

**Success Criteria:**

- Can load card data from files
- Can create new cards with templates
- Can update card status
- Handles errors gracefully

---

### **STEP 6: Create Query Executor**

**File:** `src/board/QueryExecutor.ts` (NEW)

**Action:** Execute DataviewJS queries and return card files.

```typescript
import { App, TFile } from "obsidian";
import { DataviewHelper } from "../utils/dataview";
import { CardManager } from "../card/CardManager";
import { CardData } from "../types";

export class QueryExecutor {
  app: App;
  dataviewHelper: DataviewHelper;
  cardManager: CardManager;

  constructor(app: App) {
    this.app = app;
    this.dataviewHelper = new DataviewHelper(app);
    this.cardManager = new CardManager(app);
  }

  /**
   * Execute query and return card data
   */
  async executeQuery(query: string, sourcePath: string): Promise<CardData[]> {
    // Execute DataviewJS query
    const result = await this.dataviewHelper.executeQuery(query, sourcePath);

    if (!result.successful) {
      console.error("Query execution failed:", result.error);
      return [];
    }

    // Parse file paths from result
    const filePaths = this.dataviewHelper.parsePageResults(result.value);

    // Load files
    const files = this.getFilesFromPaths(filePaths);

    // Load card data
    const cards = await this.cardManager.loadCards(files);

    return cards;
  }

  /**
   * Convert file paths to TFile objects
   */
  private getFilesFromPaths(paths: string[]): TFile[] {
    const files: TFile[] = [];

    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        files.push(file);
      }
    }

    return files;
  }
}
```

**Success Criteria:**

- Can execute DataviewJS queries
- Returns card data array
- Handles query errors

---

## 🎯 Phase 3: UI Components (Steps 7-9)

### **STEP 7: Create Card Renderer**

**File:** `src/board/CardRenderer.ts` (NEW)

**Action:** Render individual card UI elements.

```typescript
import { App, setIcon } from "obsidian";
import { CardData } from "../types";

export class CardRenderer {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Render a card element
   */
  render(card: CardData, container: HTMLElement): HTMLElement {
    const cardEl = container.createDiv({ cls: "kb-card" });
    cardEl.dataset["path"] = card.file.path;

    // Make draggable
    cardEl.draggable = true;

    // Priority indicator
    if (card.metadata.priority) {
      this.renderPriority(cardEl, card.metadata.priority);
    }

    // Title
    const titleEl = cardEl.createDiv({ cls: "kb-card-title" });
    titleEl.textContent = card.title;

    // Metadata row
    const metaEl = cardEl.createDiv({ cls: "kb-card-meta" });

    // Due date
    if (card.metadata.due) {
      this.renderDueDate(metaEl, card.metadata.due);
    }

    // Assignee
    if (card.metadata.assignee) {
      this.renderAssignee(metaEl, card.metadata.assignee);
    }

    // Tags
    if (card.metadata.tags && card.metadata.tags.length > 0) {
      this.renderTags(cardEl, card.metadata.tags);
    }

    return cardEl;
  }

  /**
   * Render priority indicator
   */
  private renderPriority(container: HTMLElement, priority: string): void {
    const priorityEl = container.createDiv({
      cls: `kb-priority kb-priority-${priority}`,
    });

    const icon =
      priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
    priorityEl.textContent = icon;
  }

  /**
   * Render due date
   */
  private renderDueDate(container: HTMLElement, dueDate: string): void {
    const dueEl = container.createSpan({ cls: "kb-due" });

    // Parse date
    const date = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if overdue
    if (date < today) {
      dueEl.addClass("kb-overdue");
    }

    // Format date
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    dueEl.innerHTML = `📅 ${formatted}`;
  }

  /**
   * Render assignee
   */
  private renderAssignee(container: HTMLElement, assignee: string | any): void {
    const assigneeEl = container.createSpan({ cls: "kb-assignee" });

    // Handle link format [[Person]]
    let name = typeof assignee === "string" ? assignee : assignee.path;
    name = name.replace(/\[\[(.+?)\]\]/, "$1");

    assigneeEl.innerHTML = `@${name}`;
  }

  /**
   * Render tags
   */
  private renderTags(container: HTMLElement, tags: string[]): void {
    const tagsEl = container.createDiv({ cls: "kb-tags" });

    // Show first 3 tags
    const displayTags = tags.slice(0, 3);

    displayTags.forEach((tag) => {
      const tagEl = tagsEl.createSpan({ cls: "kb-tag" });
      tagEl.textContent = tag.replace("#", "");
    });

    // Show "+N more" if there are more tags
    if (tags.length > 3) {
      const moreEl = tagsEl.createSpan({ cls: "kb-tag kb-tag-more" });
      moreEl.textContent = `+${tags.length - 3}`;
    }
  }
}
```

**Success Criteria:**

- Cards render with title, metadata, tags
- Priority colors show correctly
- Overdue dates are highlighted
- Cards are draggable

---

### **STEP 8: Create Column Renderer**

**File:** `src/board/ColumnRenderer. ts` (NEW)

**Action:** Render kanban columns.

```typescript
import { App } from "obsidian";
import { ColumnConfig, CardData } from "../types";
import { CardRenderer } from "./CardRenderer";

export class ColumnRenderer {
  app: App;
  cardRenderer: CardRenderer;

  constructor(app: App) {
    this.app = app;
    this.cardRenderer = new CardRenderer(app);
  }

  /**
   * Render a column
   */
  render(
    config: ColumnConfig,
    cards: CardData[],
    container: HTMLElement,
    onCardClick: (card: CardData) => void,
    onAddCard: (status: string) => void
  ): HTMLElement {
    const columnEl = container.createDiv({ cls: "kb-column" });
    columnEl.dataset["status"] = config.status;

    // Apply custom color
    if (config.color) {
      columnEl.style.borderTopColor = config.color;
    }

    // Render header
    this.renderHeader(columnEl, config, cards.length);

    // Render cards container
    const cardsContainer = columnEl.createDiv({ cls: "kb-column-cards" });
    cardsContainer.dataset["status"] = config.status;

    // Render cards
    cards.forEach((card) => {
      const cardEl = this.cardRenderer.render(card, cardsContainer);

      // Click handler
      cardEl.addEventListener("click", () => {
        onCardClick(card);
      });
    });

    // Render add button
    this.renderAddButton(columnEl, config.status, onAddCard);

    // Check WIP limit
    if (config.limit && cards.length > config.limit) {
      columnEl.addClass("kb-column-over-limit");
    }

    return columnEl;
  }

  /**
   * Render column header
   */
  private renderHeader(
    container: HTMLElement,
    config: ColumnConfig,
    cardCount: number
  ): void {
    const headerEl = container.createDiv({ cls: "kb-column-header" });

    // Title
    const titleEl = headerEl.createSpan({ cls: "kb-column-title" });
    titleEl.textContent = config.name;

    // Count
    const countEl = headerEl.createSpan({ cls: "kb-column-count" });
    countEl.textContent = String(cardCount);

    // WIP limit indicator
    if (config.limit) {
      countEl.textContent += ` / ${config.limit}`;

      if (cardCount > config.limit) {
        countEl.addClass("kb-over-limit");
      }
    }
  }

  /**
   * Render add card button
   */
  private renderAddButton(
    container: HTMLElement,
    status: string,
    onAddCard: (status: string) => void
  ): void {
    const addBtn = container.createDiv({ cls: "kb-add-btn" });
    addBtn.textContent = "+";
    addBtn.title = "Add card";

    addBtn.addEventListener("click", () => {
      onAddCard(status);
    });
  }
}
```

**Success Criteria:**

- Columns render with header, cards, add button
- Card count displays correctly
- WIP limit warnings show
- Custom colors apply

---

### **STEP 9: Create Main Board View**

**File:** `src/board/BoardView.ts` (NEW)

**Action:** Main board view orchestrator.

```typescript
import { App, TFile, MarkdownPostProcessorContext } from "obsidian";
import { BoardConfig, CardData, KanbanColumn } from "../types";
import { BoardParser } from "./BoardParser";
import { QueryExecutor } from "./QueryExecutor";
import { ColumnRenderer } from "./ColumnRenderer";
import { CardManager } from "../card/CardManager";
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
      loadingEl.textContent = `Error: ${error.message}`;
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

    // Render each column
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
      const cardPath =
        e.dataTransfer?.getData("text/plain") ||
        columnEl.querySelector(".kb-dragging")?.getAttribute("data-path");

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
```

**Success Criteria:**

- Board loads and displays cards
- Cards are grouped into columns
- Drag and drop works
- Click opens card file
- Add button creates new card

---

## 🎯 Phase 4: Plugin Integration (Steps 10-12)

### **STEP 10: Update Main Plugin File**

**File:** `src/main.ts`

**Action:** Integrate file-based kanban into main plugin.

````typescript
import { Plugin, MarkdownPostProcessorContext, MarkdownView, TFile } from 'obsidian';
import { parseTodoBlock } from './parser';
import { KanbanBoard } from './kanban';
import { KanbanBlockSettings, DEFAULT_SETTINGS, KanbanBlockSettingTab } from './settings';
import { BoardParser } from './board/BoardParser';
import { BoardView } from './board/BoardView';
import { DataviewHelper } from './utils/dataview';

export default class KanbanBlockPlugin extends Plugin {
	settings: KanbanBlockSettings;
	dataviewHelper: DataviewHelper;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new KanbanBlockSettingTab(this.app, this));

		this.dataviewHelper = new DataviewHelper(this.app);

		// KEEP:  Legacy todo block processor
		this.registerMarkdownCodeBlockProcessor('todo', (source, el, ctx) => {
			this.processLegacyTodoBlock(source, el, ctx);
		});

		// NEW: File-based kanban processor
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			await this.processFileBased Kanban(el, ctx);
		});

		console.log('Kanban Block Plugin loaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Process legacy todo code blocks (KEEP for backward compatibility)
	 */
	private processLegacyTodoBlock(
		source: string,
		el: HTMLElement,
		ctx:  MarkdownPostProcessorContext
	): void {
		const { items, ignoredLines } = parseTodoBlock(source);

		new KanbanBoard(
			el,
			items,
			ignoredLines,
			(newMarkdown) => {
				this.updateSource(ctx, source, newMarkdown);
			},
			this.app,
			this,
			ctx. sourcePath,
			this.settings. columnNames,
			this.settings.centerBoard
		);
	}

	/**
	 * Process file-based kanban boards (NEW)
	 */
	private async processFileBasedKanban(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		// Check if file-based is enabled
		if (!this.settings.enableFileBased) return;

		// Check if Dataview is required and available
		if (this.settings.requireDataview && !this.dataviewHelper.isAvailable()) {
			return; // Silently skip if Dataview not available
		}

		// Get source file
		const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		// Check if file is a board file
		const cache = this.app.metadataCache.getFileCache(file);
		if (! BoardParser.isBoardFile(cache)) return;

		// Parse board config
		const config = BoardParser.parseBoardConfig(cache);
		if (!config) return;

		// Check if element should show board (look for specific div or section)
		// For now, render in the main content area
		const boardContainer = el.createDiv({ cls: 'kb-board-container' });

		// Create and render board view
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

	/**
	 * Update legacy todo block source (KEEP)
	 */
	private updateSource(
		ctx: MarkdownPostProcessorContext,
		oldSource: string,
		newSource: string
	): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		const content = editor.getValue();

		const codeBlockRegex = /```todo\n([\s\S]*?)```/g;
		let match;
		let found = false;

		while ((match = codeBlockRegex.exec(content)) !== null) {
			const blockContent = match[1];
			if (blockContent?. trim() === oldSource. trim()) {
				const start = editor.offsetToPos(match.index + '```todo\n'.length);
				const end = editor.offsetToPos(match.index + '```todo\n'.length + (blockContent?.length ??  0));

				const replacement = blockContent?. endsWith('\n') ?  newSource + '\n' : newSource;
				editor.replaceRange(replacement, start, end);
				found = true;
				break;
			}
		}

		if (!found) {
			console.warn('KanbanBlock: Could not find matching code block to update');
		}
	}
}
````

**Success Criteria:**

- Plugin loads both legacy and new systems
- Legacy todo blocks still work
- File-based boards render
- Settings control which features are enabled

---

### **STEP 11: Create Styles**

**File:** `styles. css`

**Action:** Add styles for file-based kanban (APPEND to existing styles).

```css
/* ============================================
   FILE-BASED KANBAN STYLES
   ============================================ */

/* Board Container */
.kb-board-wrapper {
  width: 100%;
  padding: 1rem;
  background: var(--background-primary);
}

. kb-board {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 1rem;
}

/* Loading State */
.kb-loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
  font-style: italic;
}

/* Columns */
.kb-column {
  min-width: 280px;
  max-width: 320px;
  background: var(--background-secondary);
  border-radius: 8px;
  border-top: 3px solid var(--interactive-accent);
  display: flex;
  flex-direction: column;
}

.kb-column-over-limit {
  border-top-color: var(--color-red);
}

.kb-column-header {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--background-modifier-border);
}

.kb-column-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.kb-column-count {
  background: var(--background-primary);
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
}

.kb-column-count.kb-over-limit {
  background: var(--color-red);
  color: var(--text-on-accent);
}

/* Cards Container */
.kb-column-cards {
  flex: 1;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 100px;
}

.kb-column-cards.kb-drag-over {
  background: var(--background-modifier-hover);
  border-radius: 4px;
}

/* Cards */
.kb-card {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.kb-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: var(--interactive-accent);
}

.kb-card. kb-dragging {
  opacity: 0.5;
}

/* Priority Indicator */
.kb-priority {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 0.8rem;
}

/* Card Title */
.kb-card-title {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  padding-right: 1.5rem; /* Space for priority */
}

/* Card Metadata */
.kb-card-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.kb-due {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.kb-due. kb-overdue {
  color: var(--color-red);
  font-weight: 600;
}

.kb-assignee {
  background: var(--background-secondary);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

/* Tags */
.kb-tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.kb-tag {
  background: var(--tag-background);
  color: var(--tag-color);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.kb-tag-more {
  background: var(--background-secondary);
  color: var(--text-muted);
  font-style: italic;
}

/* Add Button */
.kb-add-btn {
  margin: 0.5rem;
  padding: 0.5rem;
  text-align: center;
  color: var(--text-muted);
  cursor: pointer;
  border: 2px dashed var(--background-modifier-border);
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 1 2rem;
}

.kb-add-btn:hover {
  color: var(--interactive-accent);
  border-color: var(--interactive-accent);
  background: var(--background-secondary);
}

/* ============================================
   KEEP EXISTING LEGACY STYLES BELOW
   ============================================ */

/* ...  (keep all existing kanban-* styles for legacy todo blocks) ... */
```

**Success Criteria:**

- Board renders with proper layout
- Cards have hover effects
- Columns are scrollable horizontally
- Styles work in both light/dark themes

---

### **STEP 12: Create Board Template Command**

**File:** `src/commands/BoardCommands.ts` (NEW)

**Action:** Add commands for creating boards and cards.

```typescript
import { App, Notice, TFile } from "obsidian";
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
      new Notice("Board created! ");
    } catch (error) {
      new Notice(`Failed to create board: ${error.message}`);
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
    const boardId = cache.frontmatter["board-id"];
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
      new Notice(`Failed to create card: ${error.message}`);
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
    content = content
      .replace(/{{title}}/g, name)
      .replace(/{{status}}/g, status)
      .replace(/{{board}}/g, boardId)
      .replace(/{{date}}/g, new Date().toISOString().split("T")[0]);

    // Create file
    return await this.app.vault.create(filename, content);
  }

  /**
   * Get default card template
   */
  private getDefaultCardTemplate(): string {
    return `---
status: {{status}}
board:  {{board}}
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

/* Name Input Modal */
import { Modal, Setting } from "obsidian";

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
```

**File:** `src/main.ts` (UPDATE onload method)

**Action:** Register commands.

```typescript
import { BoardCommands } from "./commands/BoardCommands";

export default class KanbanBlockPlugin extends Plugin {
  settings: KanbanBlockSettings;
  dataviewHelper: DataviewHelper;
  boardCommands: BoardCommands; // ADD

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new KanbanBlockSettingTab(this.app, this));

    this.dataviewHelper = new DataviewHelper(this.app);

    // ADD:  Register commands
    this.boardCommands = new BoardCommands(this.app, this);
    this.boardCommands.register();

    // ...  rest of onload
  }
}
```

**Success Criteria:**

- Command palette shows "Create new Kanban board"
- Command palette shows "Create new card"
- Commands create files with proper templates
- Files have correct frontmatter

---

## 🎯 Phase 5: Testing & Polish (Steps 13-15)

### **STEP 13: Add Error Handling & Validation**

**File:** `src/utils/validation.ts` (NEW)

**Action:** Add validation utilities.

```typescript
import { Notice } from "obsidian";

export class Validator {
  /**
   * Validate board configuration
   */
  static validateBoardConfig(config: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.columns || !Array.isArray(config.columns)) {
      errors.push("Board must have columns defined");
    }

    if (config.columns && config.columns.length === 0) {
      errors.push("Board must have at least one column");
    }

    config.columns?.forEach((col: any, index: number) => {
      if (!col.name) {
        errors.push(`Column ${index + 1} missing name`);
      }
      if (!col.status) {
        errors.push(`Column ${index + 1} missing status value`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Show validation errors
   */
  static showErrors(errors: string[]): void {
    errors.forEach((error) => {
      new Notice(`Kanban:  ${error}`);
    });
  }
}
```

**File:** `src/board/BoardView.ts` (UPDATE render method)

**Action:** Add validation to board rendering.

```typescript
import { Validator } from '../utils/validation';

// In BoardView.render() method, ADD validation:
async render(): Promise<void> {
	this.container.empty();
	this.container.addClass('kb-board-wrapper');

	// ADD: Validate config
	const validation = Validator.validateBoardConfig(this.config);
	if (!validation.valid) {
		const errorEl = this.container.createDiv({ cls: 'kb-error' });
		errorEl.createEl('strong', { text: 'Board Configuration Error' });
		const errorList = errorEl.createEl('ul');
		validation.errors.forEach(error => {
			errorList.createEl('li', { text: error });
		});
		return;
	}

	// ...  rest of render method
}
```

**Success Criteria:**

- Invalid boards show error messages
- Missing columns are caught
- User gets helpful error messages

---

### **STEP 14: Add README and Documentation**

**File:** `README.md` (UPDATE)

**Action:** Add documentation for new features.

````markdown
# Kanban Block

A flexible Obsidian plugin for kanban boards with two modes:

## Features

### ��� Code Block Mode (Simple)

Render todo checkboxes as kanban boards inside code blocks.

````markdown
```todo
- [ ] Task 1
- [/] Task 2
- [x] Task 3
```
````
````

````

### 📁 File-Based Mode (Powerful)
Use files as cards with full Obsidian features:
- **Backlinks** between cards
- **Graph view** integration
- **Properties** and metadata
- **DataviewJS** queries
- **Templates** for cards

## File-Based Setup

### 1. Create a Board File

```markdown
---
type: kanban-board
board-id: my-project
columns:
  - name: 📋 To Do
    status: todo
    color: "#94a3b8"
  - name: 🚧 In Progress
    status: in-progress
    color: "#3b82f6"
  - name: ✅ Done
    status:  done
    color: "#22c55e"
---

# My Project Board

\`\`\`dataviewjs
// Query cards
return dv.pages()
  .where(p => p.board === "my-project" && p. status);
\`\`\`
```

### 2. Create Card Files

```markdown
---
status: todo
board: my-project
priority: high
due: 2026-01-15
---

# Build Feature X

Description of the task...

## Related
- [[Design Doc]]
- [[API Spec]]
```

### 3. View Your Board

Switch to **Reading View** to see the interactive kanban board!

## DataviewJS Examples

### Simple Query
```dataviewjs
return dv.pages('"Cards"').where(p => p.status
````
