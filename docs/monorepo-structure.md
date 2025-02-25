# EnclaveID Monorepo Structure

## Overview

EnclaveID is a Next.js-based application focused on providing user understanding in the AI era. The project is organized as an Nx monorepo containing multiple applications and libraries, combining TypeScript for the frontend and Python for data processing and AI agents.

## Repository Structure

The repository follows the standard Nx monorepo structure with apps and libs directories:

```
serengpty/
├── apps/
│   ├── data-pipeline/    # Python-based data processing pipeline
│   └── serengpty/        # Main Next.js web application
├── libs/
│   ├── ai-agents/        # Python-based AI agent library  
│   ├── ui/               # Reusable UI components (Shadcn UI)
│   └── ui-utils/         # UI utility functions and styles
├── docs/                 # Documentation
└── path/                 # Additional utilities
```

## Applications

### 1. Main Web Application (serengpty)

A Next.js application that serves as the primary user interface. Features include:

- Authentication (NextAuth with GitHub and email providers)
- Dashboard with data visualization
- Chat interface with AI agents
- File upload and processing (particularly WhatsApp chat archives)
- API key management

The application is structured following Next.js App Router conventions with:
- Route-based page components
- Centralized server actions
- API routes for authentication and file processing
- Shared components
- Service layers for interacting with external systems

### 2. Data Pipeline (data-pipeline)

A Python-based data processing pipeline implemented using Dagster, responsible for:

- Processing conversation data
- Running AI analysis on conversations
- Generating embeddings and clusters
- Building causal relationships and graph structures
- Communicating with various LLM providers

## Libraries

### 1. AI Agents (ai-agents)

A Python library that implements various AI agents:

- Base agent infrastructure
- Chunking agent for processing large texts
- Graph explorer agent for traversing conversation relationships
- Embedding utilities for various embedding providers

### 2. UI Components (ui)

A React component library based on Shadcn UI, containing:

- Styled UI components (buttons, inputs, dialogs, etc.)
- Custom hooks
- Layout components

### 3. UI Utilities (ui-utils)

Shared UI utility functions and styles:

- Tailwind configuration
- CSS utilities
- Styling helpers

## Architecture

The system appears to implement a confidential computing architecture with focus on security:

- Uses AKS-CC (Azure Kubernetes Service Confidential Computing)
- Leverages AMD SEV-SNP hardware for confidentiality
- Implements a Trusted Computing Base (TCB)
- Uses Azure managed HSM for secret management
- Implements mTLS and remote encrypted filesystem
- Frontend is designed to be source-mapped and hosted on IPFS for auditability

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Shadcn UI
- **Backend**: Next.js API routes, Prisma with PostgreSQL
- **Data Pipeline**: Python, Dagster, Polars
- **AI/ML**: Various LLM providers (GPT-4o, Claude, Gemini, etc.), embedding services
- **Visualization**: D3.js, Three.js, React Force Graph
- **Build/CI**: Nx, Jest, ESLint, Ruff (Python)
- **Infrastructure**: Azure (likely deployed to AKS)

## Build and Development

The project uses Bun and Poetry for package management:

- Bun for JavaScript/TypeScript dependencies
- Poetry for Python dependencies
- Nx for orchestrating the monorepo

Development workflow follows established patterns for Nx monorepos with commands documented in CLAUDE.md.