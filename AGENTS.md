# Repository Guidelines

## Project Structure & Module Organization
This repo is split into numbered learning modules. `01-Start/` holds plain HTML demos. `02-ai_chat_sdk/` is a Next.js app with UI code in `app/` and assets in `public/`. Modules `03-prompt_engineering/` through `10-deployment/` are self-contained TypeScript demos with runnable files in `src/` and optional runtime folders such as `data/`, `assets/`, `output/`, or `chroma-data/`.

Treat each module as its own package. Most include a local `package.json`, `tsconfig.json`, `.env.example`, and `README.md`.

## Build, Test, and Development Commands
Install dependencies inside the module you are changing, for example `cd 04-rag && npm install`.

- `cd 02-ai_chat_sdk && npm run dev`: start the Next.js chat app locally.
- `cd 02-ai_chat_sdk && npm run build && npm run lint`: verify production build and ESLint checks.
- `cd 03-prompt_engineering && npm run model-adapter`: run a representative TypeScript demo with `tsx`.
- `cd 04-rag && npm run rag-pipeline`: run the RAG pipeline demo.
- `cd 07-mcp && npm run server:tools`: start an MCP stdio server for local experiments.

## Coding Style & Naming Conventions
TypeScript is the default language, with `strict` mode enabled in module `tsconfig.json` files. Follow existing style: 2-space indentation in `02-ai_chat_sdk`, semicolons, and descriptive kebab-case filenames such as `prompt-templates.ts` or `tools-server.ts`. Keep demo entry points small and shared helpers in adjacent files such as `model-adapter.ts`.

Use `npm run lint` in `02-ai_chat_sdk`; other modules rely mainly on TypeScript correctness and runnable examples rather than a shared formatter.

## Testing Guidelines
There is no centralized test suite yet. Validate changes by running the relevant module script and checking console output or UI behavior. For example, run `npm run chunking` before changing `04-rag` retrieval logic, and rerun the specific `09-multimodal` demo you edited.

When adding tests, place them beside the module they cover and use clear names ending in `.test.ts`.

## Commit & Pull Request Guidelines
Recent history uses short, topic-based commits such as `rag`, `mcp`, `skills`, plus occasional conventional prefixes like `feat:`. Prefer concise subjects that name the module and change, for example `feat: improve rag chunking demo`.

Pull requests should include the affected module, setup changes to `.env` or local services, commands you ran, and screenshots for UI updates in `02-ai_chat_sdk`.

## Security & Configuration Tips
Never commit populated `.env` files, API keys, or generated caches. Copy from `.env.example`, keep secrets local, and note external requirements such as ChromaDB or Ollama when reviewers need them to reproduce your change.
