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
