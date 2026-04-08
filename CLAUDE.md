# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM-Study is an educational project teaching LLM application development to web developers using TypeScript/Node.js. It consists of 10 independent modules (not a monorepo — no root package.json). Each module is self-contained with its own `package.json`, `tsconfig.json`, and dependencies.

## Module Build & Run Commands

Each module must be operated from its own directory (`cd <module>/`). All CLI modules use `tsx` to run TypeScript directly — no separate build step (`tsconfig.json` has `noEmit: true`).

**01-Start** — Static HTML files, open directly in browser. No build step.

**02-ai_chat_sdk** — Next.js full-stack chat app:
```bash
cd 02-ai_chat_sdk && npm install
npm run dev       # Dev server at localhost:3000
npm run build     # Production build
npm run lint      # ESLint
```

**03-prompt_engineering** — Prompt techniques:
```bash
cd 03-prompt_engineering && npm install
npm run model-adapter       # Multi-provider demo
npm run prompt-templates    # Template engine demo
npm run structured-output   # Zod schema + generateObject
npm run cot-demo            # Chain-of-thought comparison
```

**04-rag** — RAG pipeline (requires ChromaDB for rag-pipeline/conversational-rag):
```bash
cd 04-rag && npm install
npm run chunking            # No API key needed
npm run embeddings          # No API key needed (downloads ~90MB model on first run)
npm run rag-pipeline        # Needs API key + ChromaDB
npm run rag-optimize        # RAG optimization experiments
npm run conversational-rag  # Multi-turn RAG
```

**05-langchain** — LangChain.js framework:
```bash
cd 05-langchain && npm install
npm run model-chat        # ChatOpenAI + streaming
npm run prompt-lcel       # LCEL chain composition
npm run output-parser     # Structured output parsing
npm run memory-chat       # Conversation memory
npm run custom-tool       # Tools + Agent (OpenAI key recommended)
npm run rag-langchain     # LangChain RAG (needs ChromaDB)
```

**06-agent** — AI Agent with LangGraph:
```bash
cd 06-agent && npm install
npm run react-agent      # ReAct pattern (manual + createReactAgent)
npm run tools-deep       # Multi-tool orchestration + error handling
npm run state-graph      # StateGraph workflows (conditions, loops, human-in-loop)
npm run memory-agent     # Agent memory (MemorySaver, multi-session)
npm run multi-agent      # Multi-Agent patterns (pipeline, routing, supervisor, debate)
```

**07-mcp** — Model Context Protocol:
```bash
cd 07-mcp && npm install
npm run mcp-basics      # Core concepts (no API key)
npm run mcp-tools       # Tool calling patterns
npm run mcp-resources   # Resource reading (no API key)
npm run mcp-prompts     # Prompt templates
npm run mcp-client      # Universal debugger (no API key)
npm run mcp-knowledge   # Knowledge base RAG via MCP
```

**08-skill** — Claude Code Skills (educational, no API key needed):
```bash
cd 08-skill && npm install
npm run skill-concepts    # Skills concepts tutorial
npm run showcase          # Configuration examples
npm run hooks-demo        # Hook mechanism
npm run settings-explain  # Settings hierarchy
npm run setup             # Install examples to .claude/
```

**09-multimodal** — Vision, image gen, speech (OpenAI key recommended):
```bash
cd 09-multimodal && npm install
npm run vision            # Image understanding (Vision)
npm run image-gen         # DALL-E 3 generation
npm run speech            # Text-to-speech (TTS)
npm run transcription     # Speech-to-text (Whisper)
npm run multimodal-chat   # Combined multimodal demo
```

**10-deployment** — Local models & production optimization:
```bash
cd 10-deployment && npm install
# Ollama demos need: ollama pull qwen3.5:9b
npm run ollama-basics     # Ollama local deployment
npm run ollama-replace    # Cloud vs local comparison
npm run caching           # Cache strategies (no API key)
npm run token-cost        # Token counting + pricing
npm run rate-limit        # Rate limiting (no API key)
npm run monitoring        # Logging + metrics (no API key)
```

## Environment Setup

Modules 02–10 use API keys (some scripts work without). Copy `.env.example` to `.env` (or `.env.local` for Next.js) and fill in at least one:
- `DEEPSEEK_API_KEY` (recommended, cheapest)
- `OPENAI_API_KEY` (required for multimodal features: DALL-E, Whisper, TTS)
- `ANTHROPIC_API_KEY`

External services required by specific modules:
- **ChromaDB** (modules 04, 05): `docker run -d -p 8000:8000 chromadb/chroma`
- **Ollama** (module 10): Install from https://ollama.com/download, then `ollama pull qwen3.5:9b`

## Architecture

### Multi-Provider Model Adapter

`model-adapter.ts` abstracts DeepSeek/OpenAI/Anthropic behind a unified interface using Vercel AI SDK. Key exports:
- `getModel(provider, modelName?)` → returns `LanguageModel`
- `chatWithModel(provider, messages, options?)` → returns response text
- `getDefaultProvider()` → auto-detects first configured provider from env vars

This file is **copied** (not shared) across modules (03, 04, 05, 06, 07, 09, 10) to keep each independently runnable. Later copies extend with additional capabilities (e.g., module 09 adds `getVisionProvider()`, module 10 adds Ollama detection via `getOllamaModels()`).

### Module 02 — Next.js Streaming Chat

- `app/page.tsx` — Client component using `useChat()` hook from `@ai-sdk/react`
- `app/api/chat/route.ts` — Streaming API route using `streamText()` with tool definitions
- `lib/tools.ts` — Tool definitions (weather lookup, calculator) using Zod schemas

### Module 04 — RAG Pipeline (Layered Design)

Each file builds on the previous:
1. `embeddings.ts` — `LocalEmbedding` wrapping `@xenova/transformers`. Default: `Xenova/bge-small-zh-v1.5` (512-dim, Chinese). Uses `hf-mirror.com` as HuggingFace mirror for China access.
2. `chunking.ts` — Fixed-size, recursive character (Chinese-friendly with 。！？ separators), paragraph-based.
3. `vector-store.ts` — `VectorStore` wrapping ChromaDB with typed `SearchResult`.
4. `rag-pipeline.ts` — Combines chunking + vector store + LLM. Supports RAG vs plain comparison.
5. `conversational-rag.ts` — Adds question rewriting for pronoun resolution in multi-turn dialogue.

### Module 05 — LangChain.js (LCEL Composition)

Uses LangChain Expression Language for composable `Prompt → Model → OutputParser` chains. Key pattern: custom `LocalEmbeddings` class adapting `@xenova/transformers` to LangChain's `Embeddings` interface. File `rag-langchain.ts` rebuilds the RAG pipeline using LangChain primitives.

### Module 06 — Agent & StateGraph

- **ReAct pattern**: Manual Thought→Action→Observation loop, then `createReactAgent` from LangGraph
- **StateGraph**: `Annotation.Root()` defines typed state schema with reducer functions (append vs overwrite). Supports conditional edges, loops, and `interrupt()` for human-in-the-loop approval
- **Multi-Agent**: 4 orchestration patterns — sequential pipeline, conditional routing, supervisor, debate
- Note: OpenAI recommended for stable function calling (DeepSeek's can be unstable)

### Module 07 — MCP (Client/Server Architecture)

Three-layer model: Host → Client → Server over JSON-RPC 2.0 (stdio transport). Servers in `src/servers/` expose Tools, Resources, and Prompts as separate processes. Clients spawn servers as subprocesses and discover capabilities dynamically. `MCPClientDebugger` class provides universal connection/introspection.

### Module 10 — Production Patterns

- **Caching**: Memory LRU (TTL + stats) and file-based (SHA256 key = model + prompt)
- **Rate limiting**: Token bucket algorithm (requests/sec + tokens/min)
- **Token cost**: Per-model pricing with cumulative tracking
- **Monitoring**: Structured JSON logging + dashboard aggregation

### CLI Script Pattern (all CLI modules)

Each `.ts` file is both a library (exports classes/functions) and a runnable demo:
```typescript
export class MyClass { ... }

const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("filename.ts");
if (isMainModule) { main().catch(console.error); }
```

## Key Conventions

- All modules use ESM (`"type": "module"` in package.json)
- TypeScript config: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- Chinese-language content throughout (comments, docs, demo output, knowledge base)
- Console output uses emoji prefixes for status (📦 loading, ✅ success, ❌ error, 🔍 search, etc.)
- No test framework — modules are validated by running demos
- ESLint only in module 02 (Next.js)

## Data & Gitignore Notes

The root `.gitignore` excludes `data/` globally, all `.env` files, and model weight files (`.bin`, `.gguf`, `.safetensors`). The `@xenova/transformers` model cache is stored in the user's home directory, not in the project. Module output directories (`output/`, `chroma-data/`) are also gitignored.
