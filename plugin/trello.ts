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
  // Prefer configuration from opencode.json, fallback to environment variables
  const pluginConfig = context.config || {}
  
  const apiKey = pluginConfig.apiKey || process.env.TRELLO_API_KEY
  const apiToken = pluginConfig.apiToken || process.env.TRELLO_API_TOKEN
  const boardId = pluginConfig.boardId || process.env.TRELLO_BOARD_ID
  const defaultListId = pluginConfig.defaultListId || process.env.TRELLO_DEFAULT_LIST_ID

  if (!apiKey || !apiToken || !boardId) {
    throw new Error(
      'Trello configuration incomplete. Please provide apiKey, apiToken, and boardId in opencode.json or environment variables.'
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

  async onInit(context: any) {
    try {
      const config = getConfig(context)
      context.log.success(`✅ Trello plugin loaded. Board ID: ${config.boardId}`)
      return config
    } catch (error: any) {
      context.log.warn(`⚠️  Trello plugin: ${error.message}`)
      return null
    }
  },

  tools: {
    trelloList: {
      description: 'List all cards on your Trello board',
      parameters: {
        listId: { type: 'string', required: false }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          const listId = args.listId || null

          const cards: TrelloCard[] = await trelloFetch(
            config,
            listId ? `/lists/${listId}/cards` : `/boards/${config.boardId}/cards`,
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

    trelloAdd: {
      description: 'Add a new card to Trello',
      parameters: {
        name: { type: 'string', required: true },
        desc: { type: 'string', required: false },
        listId: { type: 'string', required: false },
        due: { type: 'string', required: false },
        labels: { type: 'string', required: false }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          const targetListId = args.listId || config.defaultListId

          if (!targetListId) {
            context.log.warn('⚠️ No list ID provided and no default list configured.')
            return
          }

          const params: any = { idList: targetListId, name: args.name }
          if (args.desc) params.desc = args.desc
          if (args.due) params.due = args.due
          if (args.labels) params.idLabels = args.labels.split(',').map((l: string) => l.trim())

          const card: TrelloCard = await trelloFetch(config, '/cards', {
            method: 'POST',
            body: JSON.stringify(params)
          })

          context.log.success(`✅ Created card: ${card.name} (${card.shortLink})`)
        } catch (error: any) {
          context.log.error(`❌ Failed to create card: ${error.message}`)
        }
      }
    },

    trelloUpdate: {
      description: 'Update a Trello card',
      parameters: {
        cardId: { type: 'string', required: true },
        name: { type: 'string', required: false },
        desc: { type: 'string', required: false },
        closed: { type: 'boolean', required: false },
        listId: { type: 'string', required: false }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          const params: any = {}
          if (args.name) params.name = args.name
          if (args.desc) params.desc = args.desc
          if (args.closed !== undefined) params.closed = args.closed
          if (args.listId) params.idList = args.listId

          await trelloFetch(config, `/cards/${args.cardId}`, {
            method: 'PUT',
            body: JSON.stringify(params)
          })
          context.log.success(`✅ Updated card ${args.cardId}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to update card: ${error.message}`)
        }
      }
    },

    trelloDelete: {
      description: 'Delete a Trello card permanently',
      parameters: {
        cardId: { type: 'string', required: true }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          await trelloFetch(config, `/cards/${args.cardId}`, { method: 'DELETE' })
          context.log.success(`🗑️ Permanently deleted card: ${args.cardId}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to delete card: ${error.message}`)
        }
      }
    },

    trelloBoards: {
      description: 'List all your Trello boards',
      parameters: {},
      async execute(context: any) {
        try {
          const config = getConfig(context)
          const boards: TrelloBoard[] = await trelloFetch(config, '/members/me/boards', { fields: 'name,url' })
          const formatted = boards.map((board: TrelloBoard, i: number) => formatBoard(board, i)).join('\n\n')
          context.log.success(`📋 Found ${boards.length} board(s):\n\n${formatted}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to list boards: ${error.message}`)
        }
      }
    },

    trelloLists: {
      description: 'List all lists on your current board',
      parameters: {},
      async execute(context: any) {
        try {
          const config = getConfig(context)
          const lists: TrelloList[] = await trelloFetch(config, `/boards/${config.boardId}/lists`, { fields: 'name,closed,pos' })
          const formatted = lists.map((list: TrelloList, i: number) => formatList(list, i)).join('\n\n')
          context.log.success(`📋 Found ${lists.length} list(s):\n\n${formatted}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to list lists: ${error.message}`)
        }
      }
    },

    trelloDone: {
      description: 'Mark a card as done (archive it)',
      parameters: {
        cardId: { type: 'string', required: true }
      },
      async execute(context: any, args: any) {
        try {
          const config = getConfig(context)
          await trelloFetch(config, `/cards/${args.cardId}`, {
            method: 'PUT',
            body: JSON.stringify({ closed: true })
          })
          context.log.success(`✅ Marked card as done: ${args.cardId}`)
        } catch (error: any) {
          context.log.error(`❌ Failed to mark card as done: ${error.message}`)
        }
      }
    },

    trelloSetup: {
      description: 'Show Trello plugin setup instructions',
      parameters: {},
      async execute(context: any) {
        context.log.info(`
🎯 TRELLO PLUGIN SETUP
========================

1. GET API KEY: https://trello.com/app-key
2. GET API TOKEN: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=OpenCode&key=YOUR_API_KEY
3. GET BOARD ID: From Trello URL (trello.com/b/BOARD_ID/...)

Add to your opencode.json:
{
  "plugins": {
    "trello@Anes201/opencode-plugin-trello": {
      "apiKey": "...",
      "apiToken": "...",
      "boardId": "..."
    }
  }
}
        `)
      }
    }
  }
})

export default plugin
