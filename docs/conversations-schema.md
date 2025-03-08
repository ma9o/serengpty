# Conversations JSON Schema

This document defines the schema for the conversation data used in the data pipeline.

## Overview

The conversations.json file contains an array of conversation objects, representing chat interactions. Each conversation has a tree structure of messages stored in the `mapping` field, with parent-child relationships defining the conversation flow.

## JSONSchema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "create_time": { "type": "number" },
      "update_time": { "type": "number" },
      "mapping": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "message": {
              "type": ["object", "null"],
              "properties": {
                "id": { "type": "string" },
                "author": {
                  "type": "object",
                  "properties": {
                    "role": {
                      "type": "string",
                      "enum": ["user", "assistant", "system", "tool"]
                    },
                    "name": { "type": ["string", "null"] },
                    "metadata": { "type": "object" }
                  },
                  "required": ["role", "metadata"]
                },
                "create_time": { "type": ["number", "null"] },
                "update_time": { "type": ["number", "null"] },
                "content": {
                  "type": "object",
                  "properties": {
                    "content_type": { "type": "string", "enum": ["text"] },
                    "parts": { "type": "array", "items": { "type": "string" } }
                  },
                  "required": ["content_type", "parts"]
                },
                "status": { "type": "string", "enum": ["finished_successfully"] },
                "end_turn": { "type": ["boolean", "null"] },
                "weight": { "type": "number" },
                "metadata": { "type": "object" },
                "recipient": { "type": "string" },
                "channel": { "type": ["string", "null"] }
              },
              "required": ["id", "author", "content", "status", "weight", "metadata"]
            },
            "parent": { "type": ["string", "null"] },
            "children": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["id", "children"]
        }
      },
      "moderation_results": { "type": "array" },
      "current_node": { "type": "string" },
      "plugin_ids": { "type": ["array", "null"] },
      "conversation_id": { "type": "string" },
      "conversation_template_id": { "type": ["string", "null"] },
      "gizmo_id": { "type": ["string", "null"] },
      "gizmo_type": { "type": ["string", "null"] },
      "is_archived": { "type": "boolean" },
      "is_starred": { "type": ["boolean", "null"] },
      "safe_urls": { "type": "array" },
      "default_model_slug": { "type": "string" },
      "conversation_origin": { "type": ["string", "null"] },
      "voice": { "type": ["string", "null"] },
      "async_status": { "type": ["string", "null"] },
      "disabled_tool_ids": { "type": "array" },
      "id": { "type": "string" }
    },
    "required": ["title", "create_time", "update_time", "mapping", "conversation_id", "current_node", "id"]
  }
}
```

## Key Fields

- **title**: The title of the conversation
- **mapping**: Dictionary of message nodes indexed by their IDs
- **conversation_id**: Unique identifier for the conversation
- **current_node**: ID of the last message in the conversation
- **create_time/update_time**: Timestamps as Unix epoch time

## Message Structure

Each message in the mapping has:
- **id**: Unique message identifier
- **parent**: ID of the parent message
- **children**: Array of child message IDs
- **message**: Content and metadata of the message
  - **author.role**: One of "user", "assistant", "system", or "tool"
  - **content.parts**: Array containing the message text
  - **status**: Message processing status