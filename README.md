# Docsmith

Docsmith turns GitHub repositories into living developer documentation. It ingests source files, extracts code units, generates Markdown with an OpenAI-compatible LLM, detects documentation drift, proposes updates for review, and answers codebase questions with cited sources.

The workflow and dark dashboard take inspiration from [DevDocs-AI](https://github.com/Saptak-cyber/DevDocs-AI). This implementation uses the requested normalized, versioned data model and persists chat sessions.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn-compatible local UI components.
- Prisma 7, Neon Postgres, and the Neon driver adapter.
- Qdrant Cloud with repository-scoped similarity queries.
- HuggingFace Inference embeddings and a configurable OpenAI-compatible chat completion endpoint.
- GitHub REST API, Babel for JavaScript/TypeScript, and the Lezer Python syntax parser.

## Setup

Use Node.js 22.12+ (Node 24 LTS also works) and npm. Create a Neon database and obtain its connection string.

```powershell
npm install
Copy-Item .env.local.example .env.local
```

Edit `.env.local` before running database commands. Keep it out of source control.

```powershell
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The unconfigured app also renders setup instructions without making database or AI calls.

Prisma CLI loads `.env.local` through `prisma.config.ts`, using Next.js environment-file precedence. Prisma 7 stores its connection URL in that config file; the schema only declares the PostgreSQL provider. The generated client lives in `src/generated/prisma` and is excluded from Git. `npm run build` regenerates it automatically.

For the simplest setup, use Neon's **direct, non-pooler** URL for `DATABASE_URL`; both CLI schema commands and the server adapter use it. Include `sslmode=require`. Use `prisma migrate dev` and checked-in migrations when moving beyond prototyping; `db push` does not create migration history.

### Environment variables

| Variable                      | Used for                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Neon PostgreSQL connection. Required for persistent workspace features.                                                           |
| `LLM_API_KEY`                 | LLM provider credential.                                                                                                          |
| `LLM_BASE_URL`                | Provider API root, including its API version if required, e.g. `https://api.openai.com/v1`. Docsmith appends `/chat/completions`. |
| `LLM_MODEL`                   | Model identifier supported by that provider.                                                                                      |
| `HUGGINGFACE_API_KEY`         | Token with permission to use HuggingFace Inference.                                                                               |
| `QDRANT_URL`                  | Qdrant Cloud HTTPS cluster URL.                                                                                                   |
| `QDRANT_API_KEY`              | Qdrant cluster API key.                                                                                                           |
| `GITHUB_TOKEN`                | Optional for public repos; required for private repos. Grant read access to repository metadata and contents.                     |
| `GITHUB_WEBHOOK_SECRET`       | At least 16 characters; required to accept GitHub webhooks.                                                                       |
| `HUGGINGFACE_EMBEDDING_MODEL` | Optional; defaults to `BAAI/bge-small-en-v1.5`. Choose a feature-extraction model served by the `hf-inference` provider.          |
| `EMBEDDING_DIMENSIONS`        | Optional; defaults to `384`. Must match the embedding model.                                                                      |
| `QDRANT_COLLECTION`           | Optional; defaults to `docsmith_documents`.                                                                                       |

The server-only Zod environment loader validates configured values and checks required credentials when each feature is used. This lets you use ingestion before configuring the LLM, and documentation generation before configuring vector search. Restart the server after changing environment variables. Service indicators show configuration presence; `/api/health` also verifies the database connection.

Qdrant collections and the `repoId` payload index are created on first use. Changing the embedding model requires a **new collection** and a rebuild, even when the new model has the same vector dimensions. Mixing model vector spaces produces invalid retrieval results.

## Workflow

1. **Connect a repository.** Enter its GitHub URL on Overview. Leave Branch blank to use GitHub's actual default branch. Imports read an immutable commit snapshot and preserve file paths, blob SHAs, source ranges, stable symbol keys, and hashes.
2. **Generate docs.** Use Generate docs on a repository card. The browser processes small batches until every active code unit has an initial publication. Existing publications are preserved. The task can be resumed after a failed or interrupted request.
3. **Browse documentation.** Search by symbol or path, filter by repository or health, inspect the current source, and download any published Markdown version.
4. **Detect drift.** Use Sync or configure push webhooks. Signature changes and removed units become `BROKEN`; implementation changes become `POTENTIALLY_OUTDATED`; changes to another source file in the same directory can trigger `REVIEW_RECOMMENDED`. Formatting and comments do not change JavaScript/TypeScript or Python fingerprints. Related-file review is a directory heuristic, not full dependency analysis.
5. **Review updates.** Choose Draft an update from Changes or a document. Draft reviews link to a side-by-side preview and a Markdown diff. Approve publishes a new version; Dismiss retains the draft in history. A source change invalidates an older draft. Published docs stay visible until approval, and flags compare against the published source baseline across repeated syncs.
6. **Ask Docsmith.** Generate/index documentation, select a repository, and ask a question. Retrieval is filtered to that repository. Responses use current source and published documentation, cite file ranges, and save the conversation. Rebuild index retries failed indexing or repopulates a new collection.

Initial documentation is published immediately. Changes to existing documentation require draft approval. The application does not automatically spend LLM credits when a webhook arrives; a developer explicitly requests each draft.

If indexing fails, documentation still saves and its page shows the indexing error. Rebuild index can retry it. A superseded document vector cannot be used for chat: retrieved IDs are checked against the latest publication and live code unit in Postgres. Removed units and their documentation remain in history with a broken flag; repository removal cascades its relational records and cleans its vectors.

## GitHub webhooks

Expose the running server at an HTTPS URL reachable by GitHub, then add a repository webhook:

- Payload URL: `https://YOUR_HOST/api/webhooks/github`
- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET`
- Events: **Just the push event**

The handler verifies the HMAC-SHA256 signature over the raw body with a constant-time comparison. It ignores other branches and deletion events. Redelivery is safe: commit records are unique per repository and SHA, source units are upserted by stable keys, and the sync lease prevents overlapping writes. A failed parse leaves the previous snapshot and cursor intact. Leases from crashed requests can be reclaimed after ten minutes.

## API

All mutation payloads and IDs are validated with Zod. Errors use `{ "error": "message" }`, with field issues for invalid payloads.

| Method       | Endpoint                             | Input / purpose                                                      |
| ------------ | ------------------------------------ | -------------------------------------------------------------------- |
| GET          | `/api/health`                        | Database connectivity and configuration flags; 503 until configured. |
| GET          | `/api/repos`                         | List repositories.                                                   |
| POST         | `/api/ingest`                        | `{ repoUrl, branch? }`                                               |
| GET / DELETE | `/api/repos/:id`                     | Inspect or remove a repository.                                      |
| POST         | `/api/repos/:id/sync`                | Sync the tracked branch.                                             |
| POST         | `/api/generate`                      | `{ repoId, limit?: 1..10 }` for a batch, or `{ codeUnitId }`.        |
| POST         | `/api/update-draft`                  | `{ codeUnitId }`                                                     |
| POST         | `/api/update-draft/approve`          | `{ documentId }`                                                     |
| POST         | `/api/update-draft/reject`           | `{ documentId }`                                                     |
| GET          | `/api/docs/:id/download`             | Download a Markdown document version.                                |
| POST         | `/api/repos/:id/index`               | `{ cursor? }`; returns `nextCursor` for the next batch.              |
| GET          | `/api/changes?repoId=...`            | Recent commits and current staleness flags.                          |
| GET          | `/api/chat?repoId=...&sessionId=...` | Sessions and optional conversation history.                          |
| POST         | `/api/chat`                          | `{ repoId, sessionId?, message }`                                    |
| POST         | `/api/webhooks/github`               | Signed GitHub push payload.                                          |

## Data model

Repository → File → CodeUnit → Documentation. Every document version records the signature/body hashes it was generated from. A code unit has one current StalenessFlag; a repository has many Commit and ChatSession records; sessions own ordered ChatMessage records with JSON source citations. Repository deletion cascades its owned records.

Commit identity is `(repoId, sha)`, so the same Git commit may exist in forks or different tracked branches. `StalenessFlag.commitSha` is provenance text rather than a foreign key because a flag may refer to a force-pushed commit outside ingested history. Files and code units use soft deletion to retain docs for removed source. Updates and draft approvals lock code-unit rows to serialize competing reviews and preserve version ordering.

## Project structure

```text
prisma/schema.prisma       Database models, enums, constraints, and indexes
prisma.config.ts           Prisma CLI environment and datasource setup
src/app/                   App Router pages and thin API routes
src/components/            Dashboard, review, and chat UI
src/components/ui/         Local shadcn-style primitives
src/lib/env.ts             Typed, server-only environment validation
src/lib/prisma.ts          Lazy singleton Neon/Prisma client
src/lib/github.ts          GitHub REST requests and immutable snapshots
src/lib/parsers/           Babel and Python parsing + semantic fingerprints
src/lib/repositories.ts    Ingestion, atomic synchronization, commit tracking
src/lib/documentation.ts   Generation, versions, draft review, vector indexing
src/lib/llm.ts             OpenAI-compatible chat completion transport
src/lib/embeddings.ts      HuggingFace embeddings and output normalization
src/lib/qdrant.ts          Collection lifecycle and repository-scoped retrieval
src/lib/chat.ts            RAG context and persisted conversations
tests/                    Parser, staleness, webhook, env, and integration-boundary tests
```

shadcn aliases and CSS variables are configured in `components.json` and `src/app/globals.css`. Add more components with `npx shadcn@latest add <component>`.

## Verification

```powershell
npx prisma validate
npm run typecheck
npm run lint
npm test
npm run build
```

These checks do not need service credentials. For a live smoke test, configure the services and push the schema, start the server, and run:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Expect `status: ok` and `database: connected`. Then import a small GitHub repository containing a TypeScript function, a class method, and a Python function. Verify their file paths and line ranges on Documentation. Generate docs, ask a question, and follow a citation to its source page. Reload the chat to confirm history persists.

Change a function body in GitHub and sync: expect `POTENTIALLY_OUTDATED`. Sync again: the flag must remain. Draft an update, inspect the diff, approve it, and confirm the new published version and `OK` flag. Change the signature: expect `BROKEN`. Remove the function: its historical document must remain with a removed label. Send an unsigned webhook request and confirm HTTP 401 (with a webhook secret configured).

## Operating scope

This is a local, single-operator developer workspace. It does not include user authentication or tenant isolation. Add those before exposing workspace APIs to untrusted users. Only the signed webhook route authenticates incoming external events.

Synchronous ingestion is bounded to 1,000 supported source files, 1 MB per file, and 20 MB of source per repository. Truncated GitHub trees and parse errors abort rather than silently discarding code. Large repositories need a durable job queue, resumable workers, and provider rate-limit scheduling. Initial ingestion records the snapshot's head commit; later syncs record commits since that cursor, up to 1,000 per sync. Git history before initial ingestion is not backfilled. Parser support follows the installed Babel/Lezer grammar versions.

LLM and embedding requests can incur provider charges. Chat answers are buffered rather than streamed. No mock answers, generated demo repositories, or simulated service responses are used by the application.

### This workstation's storage

During development, C: ran out of free space. With approval, dependencies and build output were stored in `E:\Docsmith-runtime-Docsimth` and linked into this checkout using Windows junctions. The old npm cache was preserved at `E:\Docsmith-runtime-Docsimth\previous-npm-cache`. Source files remain in this repository.

On this workstation, avoid running `npm install` directly against the `node_modules` junction, because npm replaces it. After dependency changes, use:

```powershell
Copy-Item package.json E:\Docsmith-runtime-Docsimth\package.json
npm install --prefix E:\Docsmith-runtime-Docsimth --cache E:\Docsmith-runtime-Docsimth\npm-cache
Copy-Item E:\Docsmith-runtime-Docsimth\package-lock.json .\package-lock.json
```

On a normal checkout with sufficient disk space, use the standard `npm install` command from Setup.

The Next.js scripts use Webpack and `scripts/next.mjs` to preserve junction paths consistently in Node and Webpack. This avoids cross-drive resolution errors on this workstation; ordinary installations use the same commands.
