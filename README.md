# OpenCode Trello Plugin 🎯

> Full Trello integration for OpenCode - manage your Trello cards, lists, and boards directly from OpenCode interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![OpenCode](https://img.shields.io/badge/OpenCode-compatible-brightgreen.svg)

## ✨ Features

- 📋 **List cards** - View all cards on your board with status indicators
- ➕ **Add cards** - Create new cards with optional descriptions, due dates, and labels
- ✏️ **Update cards** - Modify card name, description, move between lists, or mark as done
- 🗑️ **Delete cards** - Permanently remove cards from your board
- 📊 **List boards** - View all your Trello boards
- 📁 **List lists** - View all lists on your current board
- ✅ **Mark as done** - Archive or close cards with one command
- 🔍 **Filter by list** - View cards from specific lists only

## 🚀 Installation

### Prerequisites

- [OpenCode CLI](https://github.com/anomalyco/opencode) installed
- Trello account and API credentials

### Step 1: Install from source

```bash
git clone https://github.com/YOUR_USERNAME/opencode-plugin-trello.git
cd opencode-plugin-trello

# Global installation
mkdir -p ~/.config/opencode/plugin ~/.config/opencode/command
cp plugin/trello.ts ~/.config/opencode/plugin/
cp command/*.md ~/.config/opencode/command/
```

### Step 2: Configure Environment Variables

Add these to your `~/.bashrc`, `~/.zshrc`, or shell config:

```bash
export TRELLO_API_KEY="your_api_key_here"
export TRELLO_API_TOKEN="your_api_token_here"
export TRELLO_BOARD_ID="your_board_id_here"
# Optional
export TRELLO_DEFAULT_LIST_ID="your_list_id_here"
```

## 📖 Usage

| Command | Description | Example |
|----------|-------------|----------|
| `/trello-list` | List all cards | `/trello-list` |
| `/trello-add` | Add a new card | `/trello-add "Buy groceries"` |
| `/trello-update` | Update a card | `/trello-update card123 --name "New title"` |
| `/trello-done` | Mark card as done | `/trello-done card123` |
| `/trello-lists` | List all lists | `/trello-lists` |
| `/trello-setup` | Show setup help | `/trello-setup` |

---

Made with ❤️ for the OpenCode community
