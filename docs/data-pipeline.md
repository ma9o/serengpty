# Data Pipeline Architecture

This document outlines the architecture and algorithmic components of the SerengPTY data pipeline, which processes conversation data to identify serendipitous connections between users.

## Overview

The data pipeline is built using Dagster, a data orchestration framework that organizes processing as a directed acyclic graph (DAG) of assets. Each asset represents a transformation step with explicit dependencies.

## Pipeline Flow

The pipeline follows these high-level stages:

1. **Data Ingestion**: Parse raw conversation data from various LLM providers
2. **Summarization**: Generate concise summaries of conversations
3. **Embedding**: Create vector representations of conversations
4. **Clustering**: Group semantically similar conversations
5. **Serendipity Detection**: Identify meaningful connections between users

## Key Components

### Parsed Conversations

- **Asset**: `parsed_conversations.py`
- **Purpose**: Extracts structured data from raw JSON exports
- **Logic**:
  - Processes conversations from multiple LLM providers (OpenAI, Anthropic, etc.)
  - Normalizes format differences between providers
  - Extracts metadata like timestamps, topic markers, and user information

### Conversation Summaries

- **Asset**: `conversation_summaries.py`
- **Purpose**: Creates concise, semantic summaries of conversations
- **Logic**:
  - Uses LLMs (primarily GPT-4o-mini) to generate summaries
  - Batch processing with retry logic for API failures
  - Maintains context window constraints

### Conversations Embeddings

- **Asset**: `conversations_embeddings.py`
- **Purpose**: Converts summaries to vector representations
- **Logic**:
  - Uses embedder resources to create semantic vectors
  - Supports multiple embedding models (e.g., OpenAI, BERT variants)
  - Standardizes vector dimensions for downstream processing

### Conversation Pair Clusters

- **Asset**: `conversation_pair_clusters.py`
- **Purpose**: Groups conversations by semantic similarity
- **Logic**:
  - Performs vector similarity calculation (cosine similarity)
  - Implements clustering algorithms to group related conversations
  - Filters clusters based on configurable thresholds

### Cluster Categorizations

- **Asset**: `cluster_categorizations.py`
- **Purpose**: Assigns semantic categories to conversation clusters
- **Logic**:
  - Uses LLMs to categorize conversation clusters
  - Implements consistent category taxonomies
  - Standardizes category labels for UI presentation

### Serendipity Optimization

- **Asset**: `serendipity_optimized.py`
- **Purpose**: Identifies valuable connections between user conversations
- **Algorithm**:
  1. **Score Calculation**:
     - Computes base similarity scores between conversation pairs
     - Applies category-based weightings
     - Normalizes scores for consistent comparison
  
  2. **Path Optimization**:
     - Prioritizes diverse, high-quality connections
     - Balances cohesion and diversity metrics
     - Implements multi-step path finding for indirect connections
  
  3. **Result Selection**:
     - Filters paths based on minimum quality thresholds
     - Ranks paths by composite scores
     - Limits results per user for UI presentation

## Data Partitioning

The pipeline uses Dagster partitioning by user_id to enable:
- Parallel processing of user data
- Incremental updates when new data arrives
- Isolation of processing failures

## External Resources

The pipeline integrates with:
- **LLM Services**: Multiple providers accessed through `batch_inference/llm_factory.py`
- **Embedding Services**: Vector embedding APIs via `embeddings/base_embedder_client.py`
- **Storage**: Results stored in both PostgreSQL and Azure blob storage

## Deployment Considerations

- Resource constraints are managed through Dagster resource configuration
- API rate limits are handled with exponential backoff retry policies
- Monitoring is implemented through Dagster's native observability

## Performance Optimizations

- Multi-stage processing enables caching of intermediate results
- Vector operations use optimized FAISS libraries for similarity calculations
- LLM batch processing reduces API overhead
- User-based partitioning enables horizontal scaling