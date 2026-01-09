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
