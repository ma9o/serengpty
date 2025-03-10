# Data Pipeline Asset Goals

## Core Assets

### 1. parsed_conversations.py
**Goal**: Extract structured data from raw conversation exports.
- Transform unstructured JSON from different LLM providers (OpenAI, Anthropic) into a standard format
- Create a clean, unified dataset with question-answer pairs as the fundamental unit
- Handle different schema structures and conversation formats
- Ensure proper timestamp extraction and sorting
- Serve as the foundation layer for all subsequent processing

### 2. conversation_summaries.py
**Goal**: Create concise, informative summaries of complete conversations.
- Condense multi-turn conversations into compact, meaningful summaries
- Use LLM to identify the core topics and progression of each conversation
- Flag sensitive content for proper handling and privacy protection
- Group exchanges by conversation to maintain context across interactions
- Reduce raw text volume while preserving semantic meaning

### 3. conversations_embeddings.py
**Goal**: Transform text summaries into machine-readable vector representations.
- Convert conversation summaries into dense vector embeddings
- Create a semantic representation that enables similarity-based operations
- Process efficiently in batches to handle large datasets
- Filter out invalid embeddings to ensure data quality
- Bridge the gap between human language and machine-processable format

### 4. conversation_pair_clusters.py
**Goal**: Identify semantically similar conversations across different users.
- Find similar conversations between users based on embedding similarity
- Group related conversations into meaningful clusters
- Calculate user-user similarity scores to prioritize promising connections
- Use dimension reduction and clustering techniques to handle high-dimensional data
- Find top-k most similar users by comparing averaged embeddings
- Create match groups containing potential serendipitous connections
- Create the foundation for serendipitous path discovery

### 5. cluster_categorizations.py
**Goal**: Categorize conversation clusters by domain and content type.
- Analyze conversation clusters to determine primary domain (coding, humanistic, practical)
- Use LLM to evaluate multiple conversations collectively for coherent categorization
- Ensure consistency across related conversations
- Prioritize coding-related content appropriately
- Create a structured way to filter and balance content types

### 6. serendipity_optimized.py
**Goal**: Discover meaningful connections between users' conversations.
- Identify serendipitous paths that connect users through common interests
- Balance similarity and complementarity in user content
- Generate engaging path titles and descriptions that highlight connections
- Craft actionable conversation starters between users
- Balance path discovery across different content categories (coding, humanistic, practical)
- Apply category-based ratios to control content mix (e.g., 70% humanistic, 30% practical)
- Use LLM to identify common backgrounds and unique branches between users
- Calculate balance scores to prioritize clusters with optimal conversation distribution
- Process clusters in parallel by match group for efficiency
- Remove duplicate conversation references to prevent overlap
- Optimize for user engagement and knowledge exchange

## Supporting Assets

### skeletons_clusters.py
**Goal**: Create a coarser grouping of conversations for efficient organization.
- Organize conversations into meaningful, broader categories
- Identify patterns in user behavior and interests
- Create a hierarchical structure for conversation organization
- Visualize cluster distribution for analysis
- Provide an alternative view of the conversation landscape

### utils/serendipity.py
**Goal**: Provide core algorithms and utilities for serendipity calculation.
- Generate prompts for LLM-based serendipity discovery
- Parse and validate LLM responses to extract structured path data
- Calculate balance scores to optimize path selection based on three key metrics:
  - **Imbalance score**: log(ratio) where ratio = user1_conv_count / user2_conv_count
     - Penalizes clusters where one user has many more conversations than the other
     - Lower values (closer to 0) indicate better balance between users
  - **Magnitude factor**: 1 / (total_conversations)
     - Rewards clusters with more total available conversations
     - Provides more options for creating serendipitous paths
  - **Semantic distance**: 1 - cosine_similarity(user1_embeddings, user2_embeddings)
     - Measures how semantically different the users' conversations are
- Use StandardScaler to normalize these metrics for fair comparison across clusters
- Map between different ID systems (indices and conversation IDs)
- Format conversation data for optimal processing
- Include human questions in prompts to better understand user intent
- Handle path evaluation and prioritization logic

## Pipeline Value Chain

This asset pipeline transforms raw conversation data into valuable connection opportunities through a series of increasingly sophisticated transformations:

1. **Data Extraction**: Parse raw JSON exports into structured data (parsed_conversations)
2. **Summarization**: Condense verbose conversations into meaningful summaries (conversation_summaries)
3. **Vectorization**: Convert text to mathematical representations (conversations_embeddings)
4. **User Matching**: Find similar users based on conversation content (find_top_k_users)
5. **Clustering**: Group semantically similar content across users (conversation_pair_clusters)
6. **Categorization**: Apply domain labels for filtering and prioritization (cluster_categorizations)
7. **Connection Discovery**: Identify meaningful paths between users (serendipity_optimized)

## Candidate Selection Process

The candidate selection for serendipitous paths follows these steps:

1. **User Similarity Calculation**: Calculate similarity between the current user and all other users based on average conversation embeddings
2. **Top-K Selection**: Select the most similar top-k users (default: 5) as potential matches
3. **Cluster Formation**: For each user pair, perform dimensionality reduction and clustering on their conversation embeddings
4. **Match Group Creation**: Create match groups containing potential connection candidates
5. **Category Balancing**: Apply category ratios to control the mix of content types (e.g., 70% humanistic, 30% practical)
6. **Balance Score Calculation**: Prioritize clusters based on composite score of:
   - Imbalance: How evenly conversations are distributed between users
   - Magnitude: Total number of available conversations
   - Semantic distance: Cosine similarity between user's conversation embeddings
7. **Path Generation**: Use LLM to identify common backgrounds and unique branches within each cluster
8. **Duplicate Removal**: Ensure conversations aren't reused across multiple paths
9. **Path Refinement**: Generate engaging titles, descriptions, and conversation starters

The final output enables the SerengPTY application to connect users with complementary interests and knowledge, creating opportunities for serendipitous learning and collaboration.

## Performance Optimizations

- **User-based Partitioning**: Process each user independently
- **Match Group Parallelization**: Generate serendipitous paths in parallel for different match groups
- **Dynamic Cluster Prioritization**: Continuously recalculate balance scores after each path extraction to focus on the most promising clusters
  - After extracting a path, update exclusion sets to avoid conversation reuse
  - Recalculate balance scores with remaining available conversations
  - Re-sort clusters to always work with the optimal candidate next
- **Category-based Ratios**: Configure the mix of content types to optimize engagement
- **Embedding Caching**: Reuse embeddings across pipeline stages
- **Batch Processing**: Handle conversations in batches for efficient vector operations
