import { Plugin, Tool } from '@opencode/sdk'

// ============================================================================
// TYPES
// ============================================================================

interface TrelloConfig {
  apiKey: string
  apiToken: string
  boardId: string
  defaultListId?: string
}

interface TrelloCard {
  id: string
  name: string
  desc: string
  url: string
  shortLink: string
  idList: string
  closed: boolean
  due: string | null
  labels: Array<{
    id: string
    name: string
    color: string
  }>
}

interface TrelloList {
  id: string
  name: string
  closed: boolean
  pos: number
}

interface TrelloBoard {
  id: string
  name: string
  url: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getConfig(context: any): TrelloConfig {
  const apiKey = process.env.TRELLO_API_KEY
  const apiToken = process.env.TRELLO_API_TOKEN
  const boardId = process.env.TRELLO_BOARD_ID
  const defaultListId = process.env.TRELLO_DEFAULT_LIST_ID

  if (!apiKey || !apiToken || !boardId) {
    throw new Error(
      'Trello configuration incomplete. Please set these environment variables:\n' +
      '  • TRELLO_API_KEY\n' +
      '  • TRELLO_API_TOKEN\n' +
      '  • TRELLO_BOARD_ID\n' +
      '  • TRELLO_DEFAULT_LIST_ID (optional)\n\n' +
      'Run /trello-setup for help.'
    )
  }

  return {
    apiKey,
    apiToken,
    boardId,
    defaultListId
  }
}

function buildUrl(config: TrelloConfig, path: string, params: Record<string, string> = {}): string {
  const baseUrl = 'https://api.trello.com/1'
  const urlParams = new URLSearchParams({
    key: config.apiKey,
    token: config.apiToken,
    ...params
  })

  return `${baseUrl}${path}?${urlParams.toString()}`
}

async function trelloFetch(config: TrelloConfig, path: string, options: RequestInit = {}): Promise<any> {
  const url = buildUrl(config, path)

  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Trello API error (${response.status}): ${error}`)
  }

  return response.json()
}

function formatCard(card: TrelloCard, index: number): string {
  const status = card.closed ? '🔴 Done' : '🟢 In Progress'
  const labels = card.labels && card.labels.length > 0
    ? card.labels.map((l: any) => `[${l.color} ${l.name}]`).join(' ')
    : ''
  const due = card.due ? ` 📅 ${new Date(card.due).toLocaleDateString()}` : ''
  const desc = card.desc ? `\n   ${card.desc.substring(0, 100)}${card.desc.length > 100 ? '...' : ''}` : ''

  return `${index + 1}. ${status} ${card.name}${due}${labels}\n   ID: ${card.shortLink}\n   List: ${card.idList}${desc}`
}

function formatList(list: TrelloList, index: number): string {
  const status = list.closed ? '🔴 Closed' : '🟢 Open'
  return `${index + 1}. ${status} ${list.name}\n   ID: ${list.id}`
}

function formatBoard(board: TrelloBoard, index: number): string {
  return `${index + 1}. 📋 ${board.name}\n   ID: ${board.id}\n   URL: ${board.url}`
}

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

const plugin = new Plugin({
  name: 'trello',
  version: '1.0.0',
  description: 'Full Trello integration for OpenCode',

  // Initialize plugin - validate configuration
  async onInit(context: any) {
    try {
      const config = getConfig(context)
      context.log.success(`✅ Trello plugin loaded. Board ID: ${config.boardId}`)
      return config
    } catch (error: any) {
      context.log.warn(`⚠️  ${error.message}`)
      return null
    }
  },

  // Define tools available to OpenCode
  tools: {
    // ------------------------------------------------------------------------
    // LIST CARDS
    // ------------------------------------------------------------------------
    trelloList: {
      description: 'List all cards on your Trello board',
      parameters: {
        listId: {
          type: 'string',
          description: 'Filter cards by list ID (optional)',
          required: false
        }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          const listId = args.listId || null

          const cards: TrelloCard[] = await trelloFetch(
            config,
            listId ? `/lists/${listId}/cards` : '/boards/${config.boardId}/cards',
            listId ? {} : { fields: 'name,desc,url,shortLink,idList,closed,due,labels' }
          )

          if (cards.length === 0) {
            context.log.success('📭 No cards found.')
            return
          }

          const formatted = cards.map((card: TrelloCard, i: number) => formatCard(card, i)).join('\n\n')

          context.log.success(`📋 Found ${cards.length} card(s):\n\n${formatted}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to list cards: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // ADD CARD
    // ------------------------------------------------------------------------
    trelloAdd: {
      description: 'Add a new card to Trello',
      parameters: {
        name: {
          type: 'string',
          description: 'Card name (required)',
          required: true
        },
        desc: {
          type: 'string',
          description: 'Card description (optional)',
          required: false
        },
        listId: {
          type: 'string',
          description: 'Target list ID (optional, uses default if not provided)',
          required: false
        },
        due: {
          type: 'string',
          description: 'Due date (optional, ISO format: 2026-02-03)',
          required: false
        },
        labels: {
          type: 'string',
          description: 'Comma-separated label names (optional)',
          required: false
        }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          const targetListId = args.listId || config.defaultListId

          if (!targetListId) {
            context.log.warn('⚠️  No list ID provided and no default list configured. Use /trello-lists to see available lists.')
            return
          }

          const params: any = {
            idList: targetListId,
            name: args.name
          }

          if (args.desc) params.desc = args.desc
          if (args.due) params.due = args.due
          if (args.labels) params.idLabels = args.labels.split(',').map((l: string) => l.trim())

          const card: TrelloCard = await trelloFetch(
            config,
            '/cards',
            {
              method: 'POST',
              body: JSON.stringify(params)
            }
          )

          context.log.success(
            `✅ Created card:\n` +
            `   Name: ${card.name}\n` +
            `   ID: ${card.shortLink}\n` +
            `   List: ${targetListId}\n` +
            `   URL: ${card.url}`
          )
        } catch (error: any) {
          context.log.error(`❌ Failed to create card: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // UPDATE CARD
    // ------------------------------------------------------------------------
    trelloUpdate: {
      description: 'Update a Trello card',
      parameters: {
        cardId: {
          type: 'string',
          description: 'Card ID or short link (required)',
          required: true
        },
        name: {
          type: 'string',
          description: 'New card name (optional)',
          required: false
        },
        desc: {
          type: 'string',
          description: 'New card description (optional)',
          required: false
        },
        closed: {
          type: 'boolean',
          description: 'Mark card as done/archived (optional)',
          required: false
        },
        listId: {
          type: 'string',
          description: 'Move card to different list (optional)',
          required: false
        }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          const params: any = {}

          if (args.name) params.name = args.name
          if (args.desc) params.desc = args.desc
          if (args.closed !== undefined) params.closed = args.closed
          if (args.listId) params.idList = args.listId

          const card: TrelloCard = await trelloFetch(
            config,
            `/cards/${args.cardId}`,
            {
              method: 'PUT',
              body: JSON.stringify(params)
            }
          )

          const updates: string[] = []
          if (args.name) updates.push(`name → "${args.name}"`)
          if (args.desc) updates.push('description updated')
          if (args.closed !== undefined) updates.push(args.closed ? 'marked as done' : 'reopened')
          if (args.listId) updates.push(`moved to list ${args.listId}`)

          context.log.success(
            `✅ Updated card ${args.cardId}:\n` +
            `   Changes: ${updates.join(', ') || 'none'}\n` +
            `   URL: ${card.url}`
          )
        } catch (error: any) {
          context.log.error(`❌ Failed to update card: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // DELETE CARD
    // ------------------------------------------------------------------------
    trelloDelete: {
      description: 'Delete a Trello card permanently',
      parameters: {
        cardId: {
          type: 'string',
          description: 'Card ID or short link (required)',
          required: true
        }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)

          await trelloFetch(
            config,
            `/cards/${args.cardId}`,
            { method: 'DELETE' }
          )

          context.log.success(`🗑️  Permanently deleted card: ${args.cardId}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to delete card: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // LIST BOARDS
    // ------------------------------------------------------------------------
    trelloBoards: {
      description: 'List all your Trello boards',
      parameters: {},
      async execute(context: any) {
        try {
          const config = getConfig(context)

          const boards: TrelloBoard[] = await trelloFetch(
            config,
            '/members/me/boards',
            { fields: 'name,url' }
          )

          if (boards.length === 0) {
            context.log.success('📭 No boards found.')
            return
          }

          const formatted = boards.map((board: TrelloBoard, i: number) => formatBoard(board, i)).join('\n\n')

          context.log.success(`📋 Found ${boards.length} board(s):\n\n${formatted}`)
          context.log.info('\n💡 To use a board, set TRELLO_BOARD_ID environment variable.')
        } catch (error: any) {
          context.log.error(`❌ Failed to list boards: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // LIST LISTS
    // ------------------------------------------------------------------------
    trelloLists: {
      description: 'List all lists on your current board',
      parameters: {},
      async execute(context: any) {
        try {
          const config = getConfig(context)

          const lists: TrelloList[] = await trelloFetch(
            config,
            `/boards/${config.boardId}/lists`,
            { fields: 'name,closed,pos' }
          )

          if (lists.length === 0) {
            context.log.success('📭 No lists found.')
            return
          }

          const formatted = lists.map((list: TrelloList, i: number) => formatList(list, i)).join('\n\n')

          context.log.success(`📋 Found ${lists.length} list(s):\n\n${formatted}`)
          context.log.info('\n💡 Use a list ID with /trello-add or set TRELLO_DEFAULT_LIST_ID.')
        } catch (error: any) {
          context.log.error(`❌ Failed to list lists: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // MARK AS DONE
    // ------------------------------------------------------------------------
    trelloDone: {
      description: 'Mark a card as done (archive it)',
      parameters: {
        cardId: {
          type: 'string',
          description: 'Card ID or short link (required)',
          required: true
        }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)

          const card: TrelloCard = await trelloFetch(
            config,
            `/cards/${args.cardId}`,
            {
              method: 'PUT',
              body: JSON.stringify({ closed: true })
            }
          )

          context.log.success(`✅ Marked card as done: ${card.name} (${args.cardId})`)
        } catch (error: any) {
          context.log.error(`❌ Failed to mark card as done: ${error.message}`)
        }
      }
    },

    // ------------------------------------------------------------------------
    // SETUP HELP
    // ------------------------------------------------------------------------
    trelloSetup: {
      description: 'Show Trello plugin setup instructions',
      parameters: {},
      async execute(context: any) {
        context.log.info(`
🎯 TRELLO PLUGIN SETUP
========================

1. GET API KEY
   Visit: https://trello.com/app-key

2. GET API TOKEN
   Visit: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=OpenCode&key=YOUR_API_KEY

3. GET BOARD ID
   Open any Trello board in your browser
   URL format: https://trello.com/b/BOARD_ID/board-name
   Copy the BOARD_ID from the URL

4. GET DEFAULT LIST ID
   Run /trello-lists to see all lists
   Copy the ID of the list you want as default

5. SET ENVIRONMENT VARIABLES
   Add these to your ~/.bashrc, ~/.zshrc, or shell config:

   export TRELLO_API_KEY="your_api_key_here"
   export TRELLO_API_TOKEN="your_api_token_here"
   export TRELLO_BOARD_ID="your_board_id_here"
   export TRELLO_DEFAULT_LIST_ID="your_default_list_id_here"

6. RELOAD YOUR SHELL
   source ~/.bashrc
   # or
   source ~/.zshrc

7. VERIFY SETUP
   Run: /trello-lists

   If successful, you'll see your Trello lists!
        `)
      }
    }
  }
})

export default plugin
