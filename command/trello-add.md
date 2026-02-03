---
description: Add a new card to your Trello board
tools:
  - trelloAdd
---
Add a Trello card: "{{ name }}"

{{#if desc}}Description: {{ desc }}{{/if}}
{{#if listId}}List ID: {{ listId }}{{/if}}
{{#if due}}Due: {{ due }}{{/if}}
{{#if labels}}Labels: {{ labels }}{{/if}}
