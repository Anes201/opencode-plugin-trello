---
description: Update a Trello card
tools:
  - trelloUpdate
---
Update Trello card {{ cardId }}:

{{#if name}}New name: {{ name }}{{/if}}
{{#if desc}}New description: {{ desc }}{{/if}}
{{#if closed}}Mark as: {{#if closed}}Done/Archived{{else}}Open{{/if}}{{/if}}
{{#if listId}}Move to list: {{ listId }}{{/if}}
