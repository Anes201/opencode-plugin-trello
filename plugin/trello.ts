import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"

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

async function getConfig(_ctx: any): Promise<TrelloConfig> {
  const apiKey = process.env.TRELLO_API_KEY
  const apiToken = process.env.TRELLO_API_TOKEN
  const boardId = process.env.TRELLO_BOARD_ID
  const defaultListId = process.env.TRELLO_DEFAULT_LIST_ID

  if (!apiKey || !apiToken || !boardId) {
    throw new Error(
      'Trello configuration incomplete. Please provide TRELLO_API_KEY, TRELLO_API_TOKEN, and TRELLO_BOARD_ID in your environment.'
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

async function trelloFetch(config: TrelloConfig, path: string, options: RequestInit = {}, queryParams: Record<string, string> = {}): Promise<any> {
  const url = buildUrl(config, path, queryParams)

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

export const TrelloPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      trello_list: tool({
        description: 'List all cards on your Trello board',
        args: {
          listId: tool.schema.string().optional().describe('Filter by list ID')
        },
        async execute(args: any) {
          try {
            const config = await getConfig(ctx)
            const listId = args.listId || null

            const cards: TrelloCard[] = await trelloFetch(
              config,
              listId ? `/lists/${listId}/cards` : `/boards/${config.boardId}/cards`,
              {},
              listId ? {} : { fields: 'name,desc,url,shortLink,idList,closed,due,labels' }
            )

            if (cards.length === 0) {
              return '📭 No cards found.'
            }

            const formatted = cards.map((card: TrelloCard, i: number) => formatCard(card, i)).join('\n\n')
            return `📋 Found ${cards.length} card(s):\n\n${formatted}`
          } catch (error: any) {
            return `❌ Failed to list cards: ${error.message}`
          }
        }
      }),

      trello_add: tool({
        description: 'Add a new card to Trello',
        args: {
          name: tool.schema.string().describe('Card name'),
          desc: tool.schema.string().optional().describe('Card description'),
          listId: tool.schema.string().optional().describe('Target list ID'),
          due: tool.schema.string().optional().describe('Due date (ISO string)'),
          labels: tool.schema.string().optional().describe('Comma-separated label IDs')
        },
        async execute(args: any) {
          try {
            const config = await getConfig(ctx)
            const targetListId = args.listId || config.defaultListId

            if (!targetListId) {
              return '⚠️ No list ID provided and no default list configured.'
            }

            const params: any = { idList: targetListId, name: args.name }
            if (args.desc) params.desc = args.desc
            if (args.due) params.due = args.due
            if (args.labels) params.idLabels = args.labels.split(',').map((l: string) => l.trim())

            const card: TrelloCard = await trelloFetch(config, '/cards', {
              method: 'POST',
              body: JSON.stringify(params)
            })

            return `✅ Created card: ${card.name} (${card.shortLink})`
          } catch (error: any) {
            return `❌ Failed to create card: ${error.message}`
          }
        }
      }),

      trello_update: tool({
        description: 'Update a Trello card',
        args: {
          cardId: tool.schema.string().describe('Card ID or shortLink'),
          name: tool.schema.string().optional().describe('New name'),
          desc: tool.schema.string().optional().describe('New description'),
          closed: tool.schema.boolean().optional().describe('Archive state'),
          listId: tool.schema.string().optional().describe('Move to list ID')
        },
        async execute(args: any) {
          try {
            const config = await getConfig(ctx)
            const params: any = {}
            if (args.name) params.name = args.name
            if (args.desc) params.desc = args.desc
            if (args.closed !== undefined) params.closed = args.closed
            if (args.listId) params.idList = args.listId

            await trelloFetch(config, `/cards/${args.cardId}`, {
              method: 'PUT',
              body: JSON.stringify(params)
            })
            return `✅ Updated card ${args.cardId}`
          } catch (error: any) {
            return `❌ Failed to update card: ${error.message}`
          }
        }
      }),

      trello_delete: tool({
        description: 'Delete a Trello card permanently',
        args: {
          cardId: tool.schema.string().describe('Card ID or shortLink')
        },
        async execute(args: any) {
          try {
            const config = await getConfig(ctx)
            await trelloFetch(config, `/cards/${args.cardId}`, { method: 'DELETE' })
            return `🗑️ Permanently deleted card: ${args.cardId}`
          } catch (error: any) {
            return `❌ Failed to delete card: ${error.message}`
          }
        }
      }),

      trello_boards: tool({
        description: 'List all your Trello boards',
        args: {},
        async execute() {
          try {
            const config = await getConfig(ctx)
            const boards: TrelloBoard[] = await trelloFetch(config, '/members/me/boards', {}, { fields: 'name,url' })
            const formatted = boards.map((board: TrelloBoard, i: number) => formatBoard(board, i)).join('\n\n')
            return `📋 Found ${boards.length} board(s):\n\n${formatted}`
          } catch (error: any) {
            return `❌ Failed to list boards: ${error.message}`
          }
        }
      }),

      trello_lists: tool({
        description: 'List all lists on your current board',
        args: {},
        async execute() {
          try {
            const config = await getConfig(ctx)
            const lists: TrelloList[] = await trelloFetch(config, `/boards/${config.boardId}/lists`, {}, { fields: 'name,closed,pos' })
            const formatted = lists.map((list: TrelloList, i: number) => formatList(list, i)).join('\n\n')
            return `📋 Found ${lists.length} list(s):\n\n${formatted}`
          } catch (error: any) {
            return `❌ Failed to list lists: ${error.message}`
          }
        }
      }),

      trello_done: tool({
        description: 'Mark a card as done (archive it)',
        args: {
          cardId: tool.schema.string().describe('Card ID or shortLink')
        },
        async execute(args: any) {
          try {
            const config = await getConfig(ctx)
            await trelloFetch(config, `/cards/${args.cardId}`, {
              method: 'PUT',
              body: JSON.stringify({ closed: true })
            })
            return `✅ Marked card as done: ${args.cardId}`
          } catch (error: any) {
            return `❌ Failed to mark card as done: ${error.message}`
          }
        }
      }),

      trello_setup: tool({
        description: 'Show Trello plugin setup instructions',
        args: {},
        async execute() {
          return `
🎯 TRELLO PLUGIN SETUP
========================

1. GET API KEY: https://trello.com/app-key
2. GET API TOKEN: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=OpenCode&key=YOUR_API_KEY
3. GET BOARD ID: From Trello URL (trello.com/b/BOARD_ID/...)

Add to your environment:
TRELLO_API_KEY=...
TRELLO_API_TOKEN=...
TRELLO_BOARD_ID=...
`
        }
      })
    }
  }
}

export default TrelloPlugin
