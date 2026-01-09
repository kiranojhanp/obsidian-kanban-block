import { App, PluginSettingTab, Setting } from "obsidian";
import type KanbanBlockPlugin from "./main";

export interface KanbanBlockSettings {
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

export class KanbanBlockSettingTab extends PluginSettingTab {
  plugin: KanbanBlockPlugin;

  constructor(app: App, plugin: KanbanBlockPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Kanban Board Settings" });

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

    new Setting(containerEl)
      .setName("Card width")
      .setDesc("Width of cards in pixels")
      .addSlider((slider) =>
        slider
          .setLimits(200, 500, 10)
          .setValue(this.plugin.settings.cardWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.cardWidth = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show card count")
      .setDesc("Show number of cards/WIP limit in column headers")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCardCount)
          .onChange(async (value) => {
            this.plugin.settings.showCardCount = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Require Dataview")
      .setDesc("Only render boards if Dataview plugin is available")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.requireDataview)
          .onChange(async (value) => {
            this.plugin.settings.requireDataview = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
