# CodeFly — PRD Part 5: Product UX Flows, Ownership, Lifecycle Contracts
**Version:** 1.0 | **Date:** May 2026 | **Scope:** End-to-end user experience and feature lifecycle contracts

---

## 0. Purpose

This PRD defines the single authoritative UX contract for CodeFly.

It specifies:
- user-visible flows
- state ownership
- execution ownership
- deployment/runtime ownership
- acceptance criteria
- failure states

This is not a design brainstorm. This is implementation truth for the current app.

---

## 1. Product Principles (Non-negotiable)

1. **Single authoritative state per concern**
   - Auth state: `authState` (`provider`, `token`, `userLabel`) persisted by `AUTH_STORAGE_KEY`.
   - Pending OAuth transaction state: `OAUTH_PENDING_KEY`.
   - Graph structure state: `graphData` loaded once per repo/folder.
   - Execution path source of truth: `graphData.symbolEdges` (fallback to `graphData.edges` only for legacy payloads).

2. **Single lifecycle owner per concern**
   - OAuth pending transaction lifecycle owner: `explorer.js` auth module.
   - Graph extraction lifecycle owner: `graph-generator.js` and `generate-graph.js`.
   - 3D rendering + interaction owner: `explorer.js`.
   - UI shell owner: `index.html` + DOM handlers in `explorer.js`.

3. **Fail-fast UX behavior**
   - Invalid state/token/path must fail loudly with explicit error text.
   - Do not silently continue with corrupt auth or missing graph data.

4. **No dual-path product behavior**
   - Do not keep multiple independent ways to compute execution paths in UI.
   - Paths are graph data, not UI-inferred heuristics.

---

## 2. User Personas and Jobs To Be Done

### Persona A — Solo engineer
- Wants fast repository understanding.
- Needs to locate files/functions quickly and inspect dependency flow.

### Persona B — Team lead in review / planning
- Wants to visualize architecture and blast radius.
- Needs clear call/dependency paths to support decisions.

### Persona C — Team in shared room session
- Wants a legible dashboard with clear authentication status and repository context.
- Needs repeatable flows with minimal confusion.

---

## 3. Primary Product Journeys

### Journey 1 — Start and authenticate
1. User opens app.
2. User sees start sections: public repo input, local folder, private auth.
3. User clicks GitHub or GitLab connect.
4. OAuth redirect completes.
5. App validates pending provider + state.
6. App saves auth state.
7. UI transitions to connected dashboard view.

**Success outcome:** user sees provider badge, profile summary, and repository browser.

---

### Journey 2 — Load repository graph
1. User picks repo from connected list OR pastes repo URL OR selects local folder.
2. App generates graph.
3. App initializes 3D explorer.
4. Search index and interaction layers initialize.

**Success outcome:** graph renders, camera control works, search opens, analytics panel responds.

---

### Journey 3 — Understand execution/dependency paths
1. User clicks a file node or opens search (`Cmd+K` / `Ctrl+K`).
2. User selects path result or file.
3. Execution path panel shows `CALLS` and `CALLED BY`.
4. Clicking a path row highlights source and target lanes and navigates target.

**Success outcome:** user can traverse static execution flow across files quickly.

---

### Journey 4 — Exit secured session
1. User clicks logout.
2. App clears auth state and pending OAuth state.
3. App resets repo browser UI state.
4. App returns to unauthenticated start sections.

**Success outcome:** no residual authenticated identity appears after logout.

---

## 4. Detailed UX Flow Spec

## 4.1 Start Screen Flow (Unauthenticated)

### Entry criteria
- `authState.provider === null`
- `authState.token === null`

### Visible UI
- `#publicRepoSection`
- `#localFolderSection`
- `#privateAuthSection`
- hidden `#repoBrowser`

### Exit events
- successful OAuth callback
- successful local folder load
- successful public/private repo graph load

### Error states
- invalid URL
- API failure during graph generation
- folder permission denied

---

## 4.2 GitHub OAuth Flow

### Authoritative state
- pending transaction: `OAUTH_PENDING_KEY`
- connected session: `AUTH_STORAGE_KEY`

### Sequence
1. `loginGitHub()` creates random `state`.
2. pending transaction persisted.
3. browser redirected to GitHub authorize URL.
4. callback enters `completeOAuthFromUrl()`.
5. provider routed to GitHub callback handler.
6. state validated against pending transaction.
7. token exchange via worker endpoint.
8. user profile fetch.
9. auth saved and URL cleaned.
10. UI updates and GitHub repos fetched.

### Must not happen
- validating GitLab callback against GitHub state
- leaving pending state after completed/failed flow
- showing connected dashboard with empty token

### Acceptance criteria
- no false `Invalid OAuth state` when correct callback returns
- no mixed-provider callback handling
- URL cleaned after callback

---

## 4.3 GitLab OAuth Flow

Same structure as GitHub flow, but provider is GitLab.

### Acceptance criteria
- state verification uses pending provider = `gitlab`
- successful callback loads GitLab profile + repos
- dashboard labels/badge reflect GitLab identity

---

## 4.4 Connected Dashboard Flow

### Entry criteria
- `authState.provider in {'github','gitlab'}`
- valid token present

### Visible UI
- `#repoBrowser` visible
- start sections hidden
- profile card with provider badge
- repo search + pagination controls

### Core actions
- search repos
- paginate repos
- select repo to load explorer
- logout

### Acceptance criteria
- no public/local start sections visible while connected
- provider identity visually clear

---

## 4.5 Repository Load Flow

### Inputs
- repository URL (public/private)
- repo list selection
- local directory handle

### System behavior
- run graph generation
- validate `nodes` and `edges` presence
- initialize scene + controls + overlays
- build search indices

### Failure behavior
- show explicit load error message
- keep user in recoverable state

### Acceptance criteria
- explorer launches without stale prior graph state
- keyboard and pointer lock behavior works after load

---

## 4.6 Global Search Flow (`Cmd+K` / `Ctrl+K`)

### Entry
- shortcut keydown
- overlay open

### Result types
- file
- function
- class
- variable
- path (symbol-level where available)

### Interaction contract
- selecting file/symbol flies to node
- selecting path highlights lane and opens target context
- intent mode (`?`) still supported

### Acceptance criteria
- fast response under normal graph sizes
- clear result labels (`FILE`, `FN`, `CLS`, `VAR`, `PATH`)

---

## 4.7 Execution Path Panel Flow

### Authoritative data source
- primary: `graphData.symbolEdges`
- fallback: `graphData.edges` (legacy only)

### Panel sections
- `CALLS` (outbound from selected file)
- `CALLED BY` (inbound to selected file)

### Row contract
Each row includes:
- source symbol
- target symbol
- line references
- source file and target file

### Row click behavior
- highlight source file node
- highlight target file node
- highlight file-level lane if exists
- fly to target file
- keep panel visible

### Acceptance criteria
- panel reflects currently selected node
- path click updates highlight deterministically

---

## 4.8 Logout Flow

### Sequence
1. clear `AUTH_STORAGE_KEY` state
2. clear `OAUTH_PENDING_KEY`
3. clear legacy provider-specific state keys
4. clear repo arrays and pagination
5. reset browser panel content
6. show unauthenticated start sections

### Acceptance criteria
- no stale connected identity remains
- subsequent login starts cleanly

---

## 5. Feature Inventory Matrix

| Feature | Entry Point | Owner | Primary State | Success Signal |
|---|---|---|---|---|
| Public repo load | URL input + load action | `explorer.js` + `graph-generator.js` | `graphData` | graph rendered |
| Local folder load | local folder button | `explorer.js` + `graph-generator.js` | `graphData` | graph rendered |
| GitHub OAuth | connect GitHub | `explorer.js` auth flow | `OAUTH_PENDING_KEY`, `authState` | dashboard + repos shown |
| GitLab OAuth | connect GitLab | `explorer.js` auth flow | `OAUTH_PENDING_KEY`, `authState` | dashboard + repos shown |
| Repo browser | connected dashboard | `explorer.js` | repo arrays + pagination | selectable repos listed |
| Search overlay | `Cmd+K` / `Ctrl+K` | `explorer.js` | `searchIndex`, path index | clickable results |
| Execution path panel | node select / path result | `explorer.js` | `graphData.symbolEdges` | `CALLS` + `CALLED BY` rows |
| Blast radius | analytics panel | `explorer.js` | adjacency lists | highlighted impacted files |
| IDE open | hover/panel | `explorer.js` | selected node metadata | editor or remote URL opens |
| Landmarks | analytics panel / shortcuts | `explorer.js` | saved landmarks storage | tour playback works |

---

## 6. UX Failure-State Contracts

1. **OAuth state mismatch**
   - Show explicit error.
   - Clear callback URL params.
   - Keep app in unauthenticated safe state.

2. **Token exchange failure**
   - Show provider-specific failure reason.
   - Clear pending OAuth transaction.

3. **Graph generation returns invalid shape**
   - Throw explicit error and show load error banner.

4. **Path data absent**
   - If legacy graph: fallback to file-level edges.
   - If malformed graph claiming symbol edges but invalid: fail and show explicit path data error.

5. **Local folder denied**
   - Preserve start screen, show actionable error.

---

## 7. Instrumentation Events (Required)

Track events for product visibility:
- `auth_start` (`provider`)
- `auth_success` (`provider`, `userLabel`)
- `auth_failure` (`provider`, `reason`)
- `repo_list_loaded` (`provider`, `count`)
- `repo_load_start` (`source`: public/url/list/local)
- `repo_load_success` (`provider`, `nodes`, `edges`)
- `repo_load_failure` (`reason`)
- `search_opened`
- `search_result_selected` (`type`)
- `execution_path_opened` (`nodeId`)
- `execution_path_row_selected` (`fromFile`, `toFile`, `fromSymbol`, `toSymbol`)
- `logout`

---

## 8. Release Readiness Checklist

- [ ] GitHub OAuth flow deterministic and clean
- [ ] GitLab OAuth flow deterministic and clean
- [ ] Connected dashboard hides start-screen sections
- [ ] Repo browser profile + repos render for both providers
- [ ] Search overlay returns all result types
- [ ] Execution path panel driven by symbol edges where available
- [ ] Legacy payload fallback still works
- [ ] Logout fully resets identity and pending OAuth
- [ ] No blocking regressions in explorer navigation

---

## 9. Out of Scope (for this PRD)

- Runtime tracing / runtime call stack capture
- Per-function 3D node rendering as first-class graph entities
- Multi-provider simultaneous auth session

---

## 10. Definition of Done

This PRD is satisfied when:
1. Every listed flow is implemented exactly once with clear owner.
2. State transitions are deterministic and recoverable.
3. Execution paths are sourced from graph data contract.
4. QA can execute all checklist items without ambiguous behavior.
