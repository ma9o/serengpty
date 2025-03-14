# Data Pipeline

This project contains the data pipeline components for SerengPTY, processing conversation data to discover serendipitous connections between users.

## Environment Variables

The following environment variables are required for the data pipeline:

| Variable | Description | Usage |
|----------|-------------|-------|
| `AZURE_OPENAI_API_KEY` | API key for Azure OpenAI services | Used for GPT-4o mini model inference |
| `DEEPINFRA_API_KEY` | API key for DeepInfra | Used for embedding generation |
| `OPENROUTER_API_KEY` | API key for OpenRouter | Alternative API provider for LLM inference |
| `DATABASE_URL` | PostgreSQL connection string | Used to connect to the database for storing/retrieving pipeline data |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google service account credentials in JSON format | Used for Gemini model inference |
| `API_PIPELINE_ENDPOINT` | Webhook endpoint URL | Endpoint that gets notified when pipeline processing completes |

## Environment Detection

The pipeline automatically detects its running environment:
- `LOCAL`: Default development environment (uses local file storage)
- `BRANCH`: Branch deployment in Dagster Cloud
- `PROD`: Production deployment in Dagster Cloud

## Storage Configuration

Storage locations are automatically configured based on the environment:
- Local: Files stored in the `./data` directory
- Branch/Prod: Files stored in Azure blob storage (`enclaveid-production-bucket`)

## Usage

See the [Data Pipeline documentation](../../docs/data-pipeline.md) for more details on the pipeline assets and workflow.
