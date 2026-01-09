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
    return match && match[1] ? match[1] : null;
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to create card: ${errorMessage}`);
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
