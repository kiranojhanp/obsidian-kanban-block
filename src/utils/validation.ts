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
      new Notice(`Kanban: ${error}`);
    });
  }
}
