# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (auto-rebuild on changes)
npm run build        # Production build with type checking
```

## Testing Locally

Copy built files to an Obsidian vault:

```bash
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/kanban-block/
```

Then reload Obsidian (Cmd+R).

## Architecture

This is an Obsidian plugin that transforms files with `type: kanban-board` frontmatter into interactive kanban boards using DataviewJS queries.

**Source files:**

- `main.ts` - Plugin entry point. Registers the markdown post-processor and commands.
- `board/BoardView.ts` - Main UI orchestrator for board rendering and interactions.
- `board/BoardParser.ts` - Extracts board configuration and queries from files.
- `board/QueryExecutor.ts` - Runs DataviewJS queries to find card files.
- `card/CardManager.ts` - Handles card file operations (load, create, update status).
- `settings.ts` - Plugin settings (card folder, templates, UI preferences).
- `types.ts` - TypeScript interfaces for board and card data.
- `styles.css` - Theme-aware styling for the kanban UI.

**Data flow:**

1. User opens a file with `type: kanban-board` frontmatter.
2. `BoardParser.ts` extracts specific configuration and the DataviewJS query.
3. `QueryExecutor.ts` runs the query via Dataview API to get a list of card files.
4. `CardManager.ts` loads metadata for each card file.
5. `BoardView.ts` renders the board, grouping cards into columns based on their `status` field.
6. Dragging a card to a new column updates its frontmatter `status` via `CardManager.ts`.

## Release Process

Push a tag to trigger GitHub Actions release:

```bash
git tag -a X.Y.Z -m "Release description"
git push origin X.Y.Z
```

This creates a draft release with `main.js`, `manifest.json`, `styles.css`. Publish manually on GitHub.
