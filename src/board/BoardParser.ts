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
