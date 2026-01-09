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
