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
      // Execute the query
      // Note: We use the dataview API's query method if available,
      // or try to evaluate the JS if it's a DQL/JS string
      const result = await this.dataviewAPI.query(query, sourcePath);

      return {
        successful: result.successful,
        value: result.value,
        error: result.error,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        successful: false,
        error: errorMessage,
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
