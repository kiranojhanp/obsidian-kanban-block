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
