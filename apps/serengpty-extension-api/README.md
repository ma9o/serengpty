# Serengpty Extension API

This is the backend API service for the Serengpty browser extension.

## Environment Variables

The following environment variables are required for the API to function properly:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string with SSL enabled | Yes |
| `AZURE_OPENAI_API_KEY` | API key for Azure OpenAI services | Yes |
| `VITE_STREAM_CHAT_API_KEY` | Stream Chat API key (client-side) | Yes |
| `STREAM_CHAT_API_SECRET` | Stream Chat API secret (server-side) | Yes |

## Development

Follow the instructions in the main repository README for development setup.

### Commands

Refer to the main CLAUDE.md file for build, lint, and test commands.