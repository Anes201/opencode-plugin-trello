---
description: List all cards from your Trello board
tools:
  - trelloList
---
{{#if listId}}List cards from list: {{ listId }}{{/if}}
{{#unless listId}}List all cards from my Trello board{{/unless}}
{{#if listId}}(Filter by list ID){{/if}}
