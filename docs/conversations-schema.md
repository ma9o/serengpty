# Conversations JSON Schema

This document defines the schema for the conversation data used in the data pipeline.

## Overview

The conversations.json file contains an array of conversation objects, representing chat interactions. The exact schema differs based on the source of the data:

1. **ChatGPT/OpenAI Format**: Tree structure with messages stored in the `mapping` field.
2. **Claude/Anthropic Format**: Linear sequence of messages stored in `chat_messages` array.

## ChatGPT Schema (OpenAI)

Each conversation has a tree structure of messages stored in the `mapping` field, with parent-child relationships defining the conversation flow.

### JSONSchema

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

### Key Fields

- **title**: The title of the conversation
- **mapping**: Dictionary of message nodes indexed by their IDs
- **conversation_id**: Unique identifier for the conversation
- **current_node**: ID of the last message in the conversation
- **create_time/update_time**: Timestamps as Unix epoch time

### Message Structure

Each message in the mapping has:
- **id**: Unique message identifier
- **parent**: ID of the parent message
- **children**: Array of child message IDs
- **message**: Content and metadata of the message
  - **author.role**: One of "user", "assistant", "system", or "tool"
  - **content.parts**: Array containing the message text
  - **status**: Message processing status

## Claude Schema (Anthropic)

Each conversation has a linear sequence of messages stored in the `chat_messages` array.

### JSONSchema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "uuid": { "type": "string" },
      "name": { "type": "string" },
      "created_at": { "type": "string", "format": "date-time" },
      "updated_at": { "type": "string", "format": "date-time" },
      "account": {
        "type": "object",
        "properties": {
          "uuid": { "type": "string" }
        },
        "required": ["uuid"]
      },
      "chat_messages": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "uuid": { "type": "string" },
            "text": { "type": "string" },
            "content": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "start_timestamp": { "type": "string", "format": "date-time" },
                  "stop_timestamp": { "type": "string", "format": "date-time" },
                  "type": { "type": "string", "enum": ["text"] },
                  "text": { "type": "string" },
                  "citations": { "type": "array" }
                },
                "required": ["start_timestamp", "stop_timestamp", "type", "text", "citations"]
              }
            },
            "sender": { "type": "string", "enum": ["human", "assistant"] },
            "created_at": { "type": "string", "format": "date-time" },
            "updated_at": { "type": "string", "format": "date-time" },
            "attachments": { "type": "array" },
            "files": { "type": "array" }
          },
          "required": ["uuid", "text", "content", "sender", "created_at", "updated_at", "attachments", "files"]
        }
      }
    },
    "required": ["uuid", "name", "created_at", "updated_at", "account", "chat_messages"]
  }
}
```

### Key Fields

- **uuid**: Unique identifier for the conversation
- **name**: The title of the conversation
- **chat_messages**: Array of messages in the conversation
- **created_at/updated_at**: Timestamps in ISO 8601 format

### Message Structure

Each message in the chat_messages array has:
- **uuid**: Unique message identifier
- **text**: The full text content of the message
- **content**: Array of content blocks with timing information
  - **start_timestamp/stop_timestamp**: When the message was created/completed
  - **text**: The content of the message
  - **citations**: References to external sources (typically empty array)
- **sender**: Either "human" or "assistant"
- **attachments/files**: Arrays for any attached content (typically empty)