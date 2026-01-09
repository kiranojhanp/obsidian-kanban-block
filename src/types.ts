import { TFile } from "obsidian";

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
