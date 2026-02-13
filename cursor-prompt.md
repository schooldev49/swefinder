You are an expert full-stack engineer. Build a **real, working MVP** for a proof-based job application tool using:

- **Frontend:** React + Vite + TypeScript
- **Styling / UI:** Tailwind CSS + shadcn/ui with a modern, professional design (not a generic starter)
- **Backend / API:** Cloudflare Workers (TypeScript) exposing JSON endpoints
- **Auth & Data:** GitHub OAuth + GitHub REST API (real integration), simple persisted storage (Cloudflare KV or D1)
- **LLM:** use a `callLLM` helper; DO NOT hardcode provider or API keys

Goal: end-to-end vertical slice that a real user can use:
- Sign in with GitHub
- Choose their repos
- Paste a job description
- Get a JD-specific “Proof Packet” based on real repos, with bullets + outreach message
- View jobs on a simple tracker

---

## Product Overview

### Problem context

- Job applications have exploded (on the order of tens of percent YoY and many thousands of applications per minute) because AI tools make mass applying trivial.
- Recruiters report that AI-generated resumes and automated applications create *noise*, making it harder to find genuinely skilled candidates and burning them out.
- At the same time, developer hiring content keeps telling CS/SWE/ML students “projects and GitHub matter,” but there is no standard way to turn those projects into **fast, verifiable signal** for a specific job.

### Wedge

We are building a **proof-based helper** for **CS/SWE/ML students and early-career engineers** who:

- have at least 2–5 non-trivial coding projects (GitHub repos), and  
- are applying mostly to smaller/mid-size tech companies, startups, and researchy teams.

We are **not** trying to fix all hiring or replace LinkedIn. We help a niche where projects already matter, but presentation and proof are messy.

---

## Core Concept

For each job application, the tool creates a **Proof Packet**:

**Inputs per job:**

- User’s GitHub account and selected repos
- Pasted job description text (JD)
- Optional user-provided numbers (e.g., rough user count, dataset size, latency)

**Outputs per job:**

- Key requirements extracted from the JD (editable list)
- For each requirement, a mapping to specific evidence:
  - which project it came from
  - very short description of what they built
  - one or two links (repo path, PR, demo, notebook, doc)
  - when this happened (year, context: course, OSS, personal, startup, etc.)
- JD-aligned **resume bullets** that:
  - are concrete
  - are traceable to specific artifacts
  - are formatted to paste into a normal chronological resume
- One short **outreach note** referencing exactly one proof link
- A simple **Job Tracker** view to see jobs and packet status

This is **not** a generic AI resume generator. It behaves like an **evidence compiler + JD-specific summary**.

---

## Hard Safety / Honesty Constraints

These are non-negotiable and must be wired into both prompt and code:

1. **No hallucinated claims**
   - The app must NEVER invent metrics (e.g. “10k users”) or accomplishments that are not:
     - present in the GitHub data (e.g. README, repo metadata), OR
     - explicitly entered by the user in a form.
2. **Explicitly label user-provided numbers**
   - If the user provides numbers like “~50 users” or “p95 latency ~200ms”, store them with a `source: "user"` flag.
3. **Evidence-first**
   - Every strong claim in a bullet or mapping must be tied to:
     - a repo URL / path / PR / demo link, OR
     - explicit user input.
4. **Do NOT replace the resume**
   - We output:
     - JD-specific bullets that go into a standard reverse-chronological résumé.
     - A separate 1-page **Proof Packet** view clearly labeled as an add-on, not a replacement for the résumé.
5. **Plain-text resume bullets**
   - Bullets must be plain, single-column-friendly text (no icons/tables/fancy layouts).
   - Proof Packet can use nicer layout, but keep HTML/CSS simple.

Include these constraints in the LLM prompts and in validation logic. If there is no evidence, do not make the claim.

---

## Tech Stack & Architecture

### Frontend

- **React + Vite + TypeScript**
- **Tailwind CSS** configured
- **shadcn/ui** (e.g. Button, Card, Input, Textarea, Badge, Tabs, Table, Dialog)
- Use a clean, modern layout:
  - left sidebar or top nav for navigation
  - main content area with cards
  - consistent spacing, typography, and colors (slightly opinionated, non-generic)

### Backend

- **Cloudflare Workers** (TypeScript)
- Use a small router (e.g. a simple switch on `request.url` or a tiny routing helper)
- **Storage**:
  - Cloudflare KV or D1 for:
    - users
    - job records
    - Proof Packets metadata
  - For MVP, keep schema minimal but typed.

### Auth: GitHub OAuth

Implement **real GitHub OAuth login**:

- Create a GitHub OAuth App (client ID / secret will be plugged in by developer later).
- Flow:
  1. Frontend has a “Sign in with GitHub” button.
  2. Button redirects to `/api/auth/github/login` on the Worker.
  3. Worker redirects to GitHub’s OAuth authorize URL with appropriate scopes:
     - `read:user`
     - `repo` (only if needed; for MVP, `read:user` and `public_repo`-level access via `repo` or `read:org` is enough for reading public repos).
  4. GitHub redirects back to `/api/auth/github/callback` with `code`.
  5. Worker exchanges `code` for access token via GitHub’s token endpoint.
  6. Worker fetches basic user info (`GET https://api.github.com/user`) and primary email if needed.
  7. Worker creates or looks up a `User` record in KV/D1 and sets a secure session (e.g., signed cookie / JWT).
  8. Frontend then calls `/api/me` to get current user + GitHub username.

- Store:
  - GitHub `id`, `login`, `avatar_url`.
  - Encrypted access token (if storing; or store only short-lived session and refetch as needed, depending on design).
- Keep token handling abstract but real—no mocking.

### GitHub API Integration

After login, allow user to **browse and select repos**:

- Endpoint: `GET /api/github/repos`
  - Uses the logged-in user’s GitHub token.
  - Calls `GET https://api.github.com/user/repos?per_page=100&sort=updated` (pagination if needed).
  - Returns a filtered list: `id`, `name`, `full_name`, `description`, `html_url`, `language`, `topics`, `stargazers_count`, `fork`, `updated_at`.
- Endpoint: `GET /api/github/repo-details?full_name=owner/name`
  - Optionally fetch README or some files for better context (e.g. `GET /repos/{owner}/{repo}/readme`).
  - For MVP, you can just read metadata + README (decoded from base64).

Use this real GitHub data as the base for evidence.

---

## Data Model (MVP)

Use TypeScript interfaces shared between frontend and backend:

```ts
export interface User {
  id: string;
  githubId: number;
  githubLogin: string;
  githubAvatarUrl: string;
  createdAt: string;
}

export interface Project {
  id: string;
  fullName: string; // "owner/repo"
  htmlUrl: string;
  description?: string;
  primaryLanguage?: string;
  topics: string[];
  lastUpdated: string;
  demoUrl?: string;
  context?: string; // "Course project", "Personal", etc.
  year?: number;
}

export interface Job {
  id: string;
  title: string;
  company?: string;
  rawDescription: string;
  createdAt: string;
  status: JobStatus;
}

export type JobStatus =
  | "DRAFT"
  | "PROOF_GENERATED"
  | "APPLIED"
  | "INTERVIEW"
  | "REJECTED"
  | "OFFER";

export interface Requirement {
  id: string;
  jobId: string;
  text: string;
  priority: number;
  notes?: string;
}

export interface Evidence {
  id: string;
  projectId: string;
  projectFullName: string;
  title: string;
  description?: string;
  repoPath?: string;
  fileUrl?: string;
  demoUrl?: string;
  year?: number;
  context?: string;
  metrics?: Record<
    string,
    { value: string | number; source: "user" | "repo" }
  >;
}

export interface EvidenceMapping {
  id: string;
  requirementId: string;
  evidenceId: string;
  relevanceScore: number; // 0-1
  rationale?: string;
}

export interface ProofPacket {
  id: string;
  jobId: string;
  title: string; // e.g. "Proof Packet – SWE Intern @ X"
  summary: string;
  requirements: Requirement[];
  mappings: EvidenceMappingWithEvidence[];
  bullets: string[]; // plain text resume bullets
  outreachNote: string;
  createdAt: string;
}

export interface EvidenceMappingWithEvidence extends EvidenceMapping {
  evidence: Evidence;
}
```

Persist minimal versions of these in KV/D1.

---

## Backend Routes (Cloudflare Worker)

Implement (at minimum):

* `GET /api/me`

  * Returns current user info if logged in.

* `GET /api/github/repos`

  * Returns list of repos for the logged-in user.

* `POST /api/projects`

  * Saves selected repos as `Project` records for the user, including optional demoUrl/context/year.

* `GET /api/projects`

  * Lists the user’s saved projects.

* `POST /api/jobs`

  * Body: `{ title, company?, jobUrl?, rawDescription }`
  * Creates a `Job` with `status = "DRAFT"`.

* `POST /api/jobs/:id/generate`

  * Body: `{ selectedProjectIds: string[], userMetrics?: ... }`
  * Steps:

    1. Load job + selected projects from storage.
    2. Use `callLLM` to:

       * Extract key requirements from `rawDescription`.
       * Map requirements to evidence (projects).
       * Generate bullets + outreach note.
    3. Enforce honesty constraints (no evidence → no claim).
    4. Save a `ProofPacket` for that job.
    5. Update job status to `"PROOF_GENERATED"`.
    6. Return `ProofPacket`.

* `GET /api/jobs`

  * Lists user’s jobs with basic info + status.

* `GET /api/jobs/:id`

  * Returns job + associated `ProofPacket` (if exists).

Document where to plug in real GitHub OAuth client ID/secret and the LLM provider.

---

## LLM Integration & Prompts

Create `llm/callLLM.ts`:

```ts
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMResponse {
  raw: string;
}

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  // TODO: developer plugs in real provider (OpenAI, etc.)
  // For now, throw or stub.
  throw new Error("callLLM not implemented");
}
```

Create `llm/prompts.ts` with helpers:

1. `buildRequirementsPrompt(jobDescription: string)`

   * Ask for a JSON array of 5–10 key requirements.

2. `buildEvidenceMappingPrompt(jobDescription, requirements, projects)`

   * Provide structured project info (name, description, topics, maybe snippet of README).
   * Ask for, per requirement:

     * up to 2 matching projects
     * short description
     * which links to use, and why.
   * Explicit instruction: if no suitable evidence exists, explicitly mark that requirement as “no visible evidence” and DO NOT fabricate.

3. `buildBulletsAndOutreachPrompt(requirements, mappings)`

   * Ask for:

     * 3–6 concise bullets tailored to this JD, each referencing specific work.
     * 1 short outreach note referencing exactly one proof link.
   * Explicitly remind: no invented metrics or accomplishments.

Include in **every system prompt** something like:

> You are helping a student apply for a specific SWE/CS/ML job.
> You must NOT invent metrics, numbers, or achievements that are not clearly supported by the input repositories or user-provided details.
> If evidence is missing for a requirement, mark it as lacking evidence or suggest the user add or build something, but do NOT fabricate proof.

The backend should parse LLM responses into structured types and validate. If parsing fails, return an error to the UI.

---

## Frontend UI / UX

Use a modern, opinionated UI with shadcn components.

### Layout

* Basic layout:

  * Top navbar: app name/logo, “Projects”, “Jobs”, user avatar with GitHub login status.
  * Main content: container with Cards and sections.
* Color palette:

  * Subtle background (e.g., `bg-slate-950` or `bg-slate-900` with contrast)
  * Cards with rounded corners and drop shadows.
  * Use Tailwind spacing (`p-6`, `gap-6`) for a clean, non-generic look.

### Screens

1. **Landing (`/`)**

   * Hero section explaining:

     * “Turn your GitHub projects into job-specific proof.”
   * CTA button: “Sign in with GitHub”
   * Brief 3-step graphic/summary:

     * Connect your repos → Paste a job → Get a Proof Packet.

2. **Projects (`/projects`)**

   * Show GitHub user info at the top (avatar, username).
   * Button: “Import GitHub Repos” → calls `/api/github/repos`.
   * List repos in a table or grid of cards with:

     * repo name
     * description
     * language
     * last updated
   * Checkbox / selection control for which repos to “save as projects”.
   * For saved projects, allow editing:

     * context (Personal / Course / Open Source / Startup)
     * year
     * optional demo URL
   * Button: “Save selected as projects”.

3. **New Job (`/jobs/new`)**

   * Form:

     * Job title
     * Company
     * Job URL
     * JD textarea
     * Multi-select of saved projects to use for this job.
   * On submit:

     * Create job
     * Call `/api/jobs/:id/generate`
     * Navigate to `/jobs/:id`.

4. **Job / Proof Packet (`/jobs/:id`)

   * Top card: job title, company, link, status.
   * Section: Key requirements (render as editable list, maybe in a Card with numbered items).
   * Section: Requirement → Evidence mapping:

     * For each requirement, show evidence chips:

       * project name
       * short description
       * links badges to repo/demo.
   * Section: Resume bullets (each with copy-to-clipboard).
   * Section: Outreach note (textarea-style display + copy button).
   * Button: “Mark as Applied” (changes status in tracker).

5. **Jobs list / Tracker (`/jobs`)

   * Table:

     * Job title
     * Company
     * Status
     * Created date
   * Link each row to `/jobs/:id`.

Make the UI feel like a serious SaaS tool:

* use shadcn `Card`, `Button`, `Input`, `Textarea`, `Table`, `Badge`, `Avatar`, `Dialog` where appropriate.
* avoid default, unstyled HTML where possible.

---

## Code Quality Expectations

* Use TypeScript everywhere.
* Strongly type all API responses and frontend hooks.
* Add basic error/empty/loading states in the UI.
* Make sure the auth flow is complete enough for local dev:

  * document the GitHub OAuth env vars (client ID, secret, callback URL) in README.
* Keep components small and composable (`ProjectList`, `JobForm`, `ProofPacketView`, etc.).
* Ensure no obvious runtime errors (no `any` abuse, proper null checks).

---

## Deliverables

1. Vite + React + TS app with Tailwind + shadcn configured and a non-generic, modern layout.
2. Cloudflare Worker with:

   * GitHub OAuth login + callback endpoints.
   * `/api/me`, `/api/github/repos`, `/api/projects`, `/api/jobs`, `/api/jobs/:id`, `/api/jobs/:id/generate`.
3. `llm` module with:

   * `callLLM` stub
   * prompt builder functions
4. README with:

   * how to set up GitHub OAuth app
   * how to configure env vars for Worker and frontend
   * how to run dev (`npm run dev` or `pnpm dev`, `wrangler dev`)

Focus on shipping a working vertical slice: a user can log in with GitHub, choose repos, paste a JD, click “Generate Proof Packet,” and see a professional-looking, usable proof screen.
