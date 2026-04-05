# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM-Study is an educational project teaching LLM application development to web developers using TypeScript/Node.js. It consists of independent modules (not a monorepo — no root package.json). Each module is self-contained with its own dependencies.

## Module Build & Run Commands

Each module must be operated from its own directory (`cd <module>/`).

**01-Start** — Static HTML files, open directly in browser. No build step.

**02-ai_chat_sdk** — Next.js full-stack chat app:
```bash
cd 02-ai_chat_sdk
npm install
npm run dev       # Dev server at localhost:3000
npm run build     # Production build
npm run lint      # ESLint
```

**03-prompt_engineering** — CLI TypeScript scripts:
```bash
cd 03-prompt_engineering
npm install
npm run model-adapter       # Multi-provider demo
npm run prompt-templates    # Template engine demo
npm run structured-output   # Zod schema + generateObject
npm run cot-demo            # Chain-of-thought comparison
```

**04-rag** — RAG pipeline CLI scripts:
```bash
cd 04-rag
npm install
npm run chunking            # Text chunking strategies (no API key needed)
npm run embeddings          # Local embedding demo (no API key needed, downloads ~90MB model on first run)
npm run rag-pipeline        # Full RAG pipeline (needs API key)
npm run conversational-rag  # Multi-turn RAG (needs API key)
```

All CLI modules (03, 04) use `tsx` to run TypeScript directly. No separate build step — `tsconfig.json` has `noEmit: true`.

## Environment Setup

Modules 02-04 require API keys. Copy `.env.example` to `.env` (or `.env.local` for Next.js) and fill in at least one:
- `DEEPSEEK_API_KEY` (recommended, cheapest)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Module 04's `embeddings` and `chunking` scripts work without any API key (local model).

## Architecture

### Multi-Provider Model Adapter (modules 03, 04)

`model-adapter.ts` abstracts DeepSeek/OpenAI/Anthropic behind a unified interface using Vercel AI SDK. Key exports:
- `getModel(provider, modelName?)` → returns `LanguageModel`
- `chatWithModel(provider, messages, options?)` → returns response text
- `getDefaultProvider()` → auto-detects first configured provider from env vars

This file is **copied** (not shared) between modules 03 and 04 to keep each module independently runnable. The 04 copy has the demo `main()` removed.

### Module 02 Architecture (Next.js)

- `app/page.tsx` — Client component using `useChat()` hook from `@ai-sdk/react`
- `app/api/chat/route.ts` — Streaming API route using `streamText()` with tool definitions
- `lib/tools.ts` — Tool definitions (weather lookup, calculator) using Zod schemas

### Module 04 RAG Pipeline

Layered design where each file builds on the previous:
1. `embeddings.ts` — `LocalEmbedding` class wrapping `@xenova/transformers`. Default model: `Xenova/bge-small-zh-v1.5` (512-dim, Chinese-optimized). Demo compares with `all-MiniLM-L6-v2` (384-dim, English). Uses `hf-mirror.com` as HuggingFace mirror for China access. Implements ChromaDB's `IEmbeddingFunction`.
2. `chunking.ts` — Three strategies: fixed-size, recursive character (Chinese-friendly with 。！？ separators), paragraph-based.
3. `vector-store.ts` — `VectorStore` class wrapping ChromaDB with typed `SearchResult`.
4. `rag-pipeline.ts` — `RAGPipeline` class combining chunking + vector store + LLM. Supports RAG vs plain LLM comparison.
5. `conversational-rag.ts` — `ConversationalRAG` adds question rewriting for pronoun resolution in multi-turn dialogue.

### CLI Script Pattern (modules 03, 04)

Each `.ts` file is both a library (exports classes/functions) and a runnable demo:
```typescript
// Export for use by other files
export class MyClass { ... }

// Run demo only when executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("filename.ts");
if (isMainModule) { main().catch(console.error); }
```

## Key Conventions

- All modules use ESM (`"type": "module"` in package.json)
- TypeScript config: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- Chinese-language content throughout (comments, docs, demo output, knowledge base)
- Console output uses emoji prefixes for status (📦 loading, ✅ success, ❌ error, 🔍 search, etc.)
- `data/` directories are gitignored globally — module 04's `data/knowledge.md` must be committed explicitly or recreated

## Data & Gitignore Notes

The root `.gitignore` excludes `data/` globally and all `.env` files. Model weight files (`.bin`, `.gguf`, `.safetensors`) are also excluded. The `@xenova/transformers` model cache is stored in the user's home directory, not in the project.
