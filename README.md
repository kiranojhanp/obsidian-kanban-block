# Obsidian Kanban Block

A flexible, file-based Kanban board plugin for Obsidian that uses your existing notes as cards and Dataview for powerful card aggregation.

## Features

- **1 Card = 1 File**: Each kanban card is a real Obsidian markdown file.
- **Dataview Integration**: Use Dataview queries to specify exactly which cards appear on your board.
- **Frontmatter Powered**: Control card status, priority, tags, and due dates via YAML frontmatter.
- **Interactive Drag & Drop**: Move cards between columns to update their status automatically.
- **Full Markdown Support**: Since cards are files, you get the full power of Obsidian inside every card.
- **Relationship Mapping**: Integrated with Backlinks, Graph view, and Dataview properties.

## Setup

### 1. Create a Board File

The plugin looks for files with `type: kanban-board` in their frontmatter.

````markdown
---
type: kanban-board
board-id: dev-project
columns:
  - name: 📋 To Do
    status: todo
    color: "#94a3b8"
  - name: 🚧 In Progress
    status: in-progress
    color: "#3b82f6"
  - name: ✅ Done
    status: done
    color: "#22c55e"
---

# Project Board

```dataviewjs
// Define which cards belong here
return dv.pages()
  .where(p => p.board === "dev-project" && p.status);
```
````

### 2. Create Card Files

A card is any note that matches your board's Dataview query. It should have a `status` property matching one of your column statuses.

```markdown
---
status: todo
board: dev-project
priority: high
due: 2026-05-20
---

# Implement New Feature

Details about the feature implementation...
```

### 3. Usage

Simply switch to **Reading View** on your board file. The plugin will render the interactive board. Dragging a card to a new column will update the `status` frontmatter in the card's file automatically.

## Requirements

- **Dataview Plugin**: This plugin relies on the Dataview API to query and aggregate notes.

## Installation

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/ldomaradzki/obsidian-kanban-block/releases)
2. Create folder: `.obsidian/plugins/kanban-block/`
3. Copy the downloaded files into that folder
4. Reload Obsidian
5. Enable in Settings → Community Plugins

## Development

```bash
npm install
npm run dev    # Watch mode
npm run build  # Production build
```

## License

MIT
