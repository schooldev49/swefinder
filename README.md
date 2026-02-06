# ProofCraft

ProofCraft is a vertical slice of a proof-based job application assistant. Candidates sign in with GitHub, stage the repos that actually prove their skills, paste a job description, and generate a JD-specific "Proof Packet" with plain-text resume bullets, requirement→evidence mappings, and an outreach note.

## Repo structure

| Path | Description |
| --- | --- |
| `apps/web` | React + Vite + TypeScript frontend with Tailwind + shadcn/ui |
| `apps/worker` | Cloudflare Worker (TypeScript) for GitHub OAuth, GitHub API proxying, storage, and LLM orchestration |
| `packages/types` | Shared TypeScript interfaces consumed by both frontend and worker |
| `cursor-prompt.md` | Agent instructions that can be dropped into Cursor/Codex |

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account with the Wrangler CLI (`npm install -g wrangler`)
- GitHub OAuth App (Client ID + Client Secret)

## Installation

```bash
npm install
```

## Configuring the Cloudflare Worker

1. **Create a KV namespace** for persisted state and copy both the production and preview IDs into `apps/worker/wrangler.toml` under `[[kv_namespaces]]` (replace the `TODO_...` values).
2. **Set required secrets/vars**:
   ```bash
   cd apps/worker
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   wrangler secret put SESSION_SECRET  # use a long random string for token encryption
   wrangler secret put FRONTEND_BASE_URL  # e.g. https://localhost:5173 during dev
   ```
3. Optional plain vars live inside `wrangler.toml`:
   - `SESSION_COOKIE_NAME` (defaults to `swefinder_session`)
   - `SESSION_MAX_AGE` (seconds; defaults to 14 days)

> 🔐 Tokens are encrypted at rest with `SESSION_SECRET` and stored in KV alongside session documents.

## Configuring the frontend

Create `apps/web/.env` from the provided example:

```bash
cp apps/web/.env.example apps/web/.env
```

- `VITE_API_BASE_URL` should point to your deployed worker (`https://your-worker.workers.dev/api`).
- For local dev, leave it blank (defaults to `/api`) and Vite will proxy requests to the worker dev server. Override `VITE_DEV_WORKER_URL` if your worker runs on a non-default port.

## Running locally

In one terminal, run the worker:

```bash
cd apps/worker
wrangler dev
```

In another terminal, start the Vite dev server:

```bash
cd apps/web
npm run dev
```

Visit `http://localhost:5173`. The frontend proxies `/api/*` calls to the worker (`http://127.0.0.1:8787` by default) and keeps cookies attached for GitHub-authenticated sessions.

## Building & testing

| Command | Description |
| --- | --- |
| `npm run --workspace apps/web build` | Type-check and build the React app to `apps/web/dist` |
| `npm run --workspace apps/worker typecheck` | Type-check the Cloudflare Worker |
| `npm run dev:web` / `npm run dev:worker` | Shortcut scripts from repo root |
| `npm run deploy:worker` | Runs `wrangler deploy` (edit `wrangler.toml` first) |

## Deploying

1. Deploy the worker with Wrangler (`npm run deploy:worker`).
2. Set `VITE_API_BASE_URL` to the deployed worker URL.
3. Build the frontend (`npm run build:web`) and host the output via your preferred static host (Cloudflare Pages, Netlify, etc.).

## LLM integration

`apps/worker/src/llm/callLLM.ts` currently throws an error to prevent accidental hallucinations. Plug in your provider of choice (OpenAI, Anthropic, local) by implementing `callLLM`. Make sure the request payloads stay JSON-only and that the honesty guardrails embedded in `llm/prompts.ts` remain intact.

## Honesty & safety checks

- GitHub metrics are pulled directly from the API; user-provided numbers are flagged with `source: "user"`.
- Proof packets only surface claims tied to repos or explicit inputs. When the LLM has no evidence for a requirement, it must say so.
- Resume bullets are plain-text strings designed to be pasted into a chronological resume.

## Troubleshooting

- **GitHub login loops**: verify the OAuth callback is set to `https://<worker-domain>/api/auth/github/callback` and that `FRONTEND_BASE_URL` matches the origin you load the app from.
- **KV namespace errors**: run `wrangler kv:namespace list` to confirm IDs and ensure both `id` and `preview_id` are populated.
- **LLM errors**: until `callLLM` is implemented, the worker will return a `502` with the stub message. Hook up a provider and redeploy.
