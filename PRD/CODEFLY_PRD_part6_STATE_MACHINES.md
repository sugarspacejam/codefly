# CodeFly — PRD Part 6: Lifecycle State Machines (Close the Loop)
**Version:** 1.0 | **Date:** May 2026 | **Purpose:** Enforce complete feature lifecycle ownership and recovery

---

## 0. Why this exists

CodeFly features must be implemented as explicit finite-state machines (FSMs), not ad-hoc event handlers.

For every feature, this PRD answers:
1. What state exists?
2. Who owns it?
3. How it is created?
4. How it is read?
5. How it is destroyed/reset?
6. What happens on refresh/restart/failure?

---

## 1. Global lifecycle rule (applies to every feature)

Every feature must implement:
- `UNINITIALIZED`
- `READY`
- `ACTIVE`
- `ERROR`
- `RESET`

And support these transitions:
- startup hydration (`UNINITIALIZED -> READY`)
- user activation (`READY -> ACTIVE`)
- failure handling (`ACTIVE -> ERROR`)
- user/system reset (`ERROR|ACTIVE -> RESET -> READY`)
- page refresh continuity (rehydrate to equivalent state)

No feature is complete without all transitions.

---

## 2. OAuth/Auth State Machine (GitHub + GitLab)

### Authoritative states
- `AUTH_UNAUTHENTICATED`
- `AUTH_PENDING_OAUTH`
- `AUTH_AUTHENTICATED`
- `AUTH_ERROR`

### Authoritative storage
- `AUTH_STORAGE_KEY` (`authState`)
- `OAUTH_PENDING_KEY` (provider + state + createdAt)

### Owner
- `explorer.js` auth lifecycle functions:
  - `setPendingOAuth`
  - `getPendingOAuth`
  - `clearPendingOAuth`
  - `completeOAuthFromUrl`
  - `loadAuthState`
  - `saveAuthState`
  - `logoutAuth`

### Transition table
1. `AUTH_UNAUTHENTICATED -> AUTH_PENDING_OAUTH`
   - Trigger: `loginGitHub()` / `loginGitLab()`
   - Action: write pending txn to storage, redirect provider

2. `AUTH_PENDING_OAUTH -> AUTH_AUTHENTICATED`
   - Trigger: provider callback + valid state
   - Action: exchange token, fetch user, persist `authState`, clear pending txn

3. `AUTH_PENDING_OAUTH -> AUTH_ERROR`
   - Trigger: callback error, state mismatch, exchange failure
   - Action: clear pending txn, clean callback URL, surface explicit error

4. `AUTH_ERROR -> AUTH_UNAUTHENTICATED`
   - Trigger: user retry OR next clean startup
   - Action: clear transient state and return safe start state

5. `AUTH_AUTHENTICATED -> AUTH_UNAUTHENTICATED`
   - Trigger: `logoutAuth`
   - Action: clear auth and pending state, reset connected UI data

### Refresh behavior (mandatory)
- On `DOMContentLoaded`:
  - read `loadAuthState()`
  - process callback via `completeOAuthFromUrl()`
  - render via `updateAuthUi()`
  - fetch connected provider data via `loadConnectedProviderData()`

### Acceptance checks
- Refresh while authenticated remains authenticated.
- Refresh during stale pending OAuth expires safely.
- Logout always returns to unauthenticated state with no residue.

---

## 3. Repo Load State Machine

### States
- `REPO_IDLE`
- `REPO_LOADING`
- `REPO_READY`
- `REPO_ERROR`

### Owner
- `explorer.js` load actions + graph generators.

### Transitions
1. `REPO_IDLE -> REPO_LOADING`
   - trigger: start button / repo select / local folder pick
2. `REPO_LOADING -> REPO_READY`
   - trigger: valid `graphData` returned (`nodes`, `edges`)
   - action: `init()`, show explorer HUD, build search index
3. `REPO_LOADING -> REPO_ERROR`
   - trigger: any load failure
   - action: show load error, preserve recoverable UI
4. `REPO_ERROR -> REPO_IDLE`
   - trigger: user retries with new input

### Reset behavior
- New load must overwrite previous `graphData` and derived caches.

---

## 4. Execution Path State Machine

### States
- `PATH_UNAVAILABLE`
- `PATH_READY_SYMBOL`
- `PATH_READY_FALLBACK`
- `PATH_ACTIVE`
- `PATH_ERROR`

### Authoritative source
- `graphData.symbolEdges` (primary)
- `graphData.edges` (fallback for legacy payloads only)

### Owner
- graph generation owns extraction.
- UI owns rendering/interactions.

### Transitions
1. `PATH_UNAVAILABLE -> PATH_READY_SYMBOL`
   - condition: `symbolEdges` exists and non-empty
2. `PATH_UNAVAILABLE -> PATH_READY_FALLBACK`
   - condition: no `symbolEdges`, but file edges exist
3. `PATH_READY_* -> PATH_ACTIVE`
   - trigger: node selected or path result clicked
4. `PATH_ACTIVE -> PATH_READY_*`
   - trigger: deselect, clear highlight, or select other node
5. `PATH_* -> PATH_ERROR`
   - trigger: malformed path payload

### Acceptance checks
- Path panel always reflects selected node.
- Search path result opens and highlights deterministic lane.
- Legacy graphs still provide fallback behavior.

---

## 5. Search State Machine (`Cmd+K` / `Ctrl+K`)

### States
- `SEARCH_CLOSED`
- `SEARCH_OPEN_EMPTY`
- `SEARCH_OPEN_RESULTS`
- `SEARCH_OPEN_NO_RESULTS`

### Owner
- `buildSearchIndex`, `performSearch`, `openSearch`, `closeSearch`

### Transitions
1. `SEARCH_CLOSED -> SEARCH_OPEN_EMPTY` on shortcut
2. `SEARCH_OPEN_EMPTY -> SEARCH_OPEN_RESULTS` on valid query with matches
3. `SEARCH_OPEN_EMPTY -> SEARCH_OPEN_NO_RESULTS` on valid query no matches
4. `SEARCH_OPEN_* -> SEARCH_CLOSED` on escape or result selection

### Acceptance checks
- search never traps keyboard focus permanently
- result selection always closes overlay and executes navigation action

---

## 6. Connected Dashboard Visibility State Machine

### States
- `UI_PUBLIC_START`
- `UI_CONNECTED_DASHBOARD`

### Owner
- `updateAuthUi`

### Rules
- `UI_CONNECTED_DASHBOARD` iff `authState.provider && authState.token`
- else `UI_PUBLIC_START`

### Required hide/show contract
When connected:
- hide `#publicRepoSection`
- hide `#localFolderSection`
- hide `#privateAuthSection`
- show `#repoBrowser`

When not connected:
- inverse of above

---

## 7. Feature lifecycle checklist template (must be copied for every new feature)

For every new feature PRD section, include this exact template:

1. **State owner:**
2. **Authoritative storage:**
3. **States:**
4. **Entry events:**
5. **Success transitions:**
6. **Failure transitions:**
7. **Reset/logout/destruction path:**
8. **Refresh/reload hydration behavior:**
9. **Telemetry events:**
10. **Acceptance tests (happy + failure + recovery):**

If any field is missing, feature is not done.

---

## 8. Current codebase audit summary (verified)

Verified in `explorer.js`:
- Auth hydration on load exists (`loadAuthState`).
- OAuth callback reconciliation exists (`completeOAuthFromUrl`).
- Connected data refresh exists (`loadConnectedProviderData`).
- Logout loop closure exists (`logoutAuth` clears auth/pending + repo browser state).

Remaining closure gap:
- execution paths still need authoritative symbol-edge lifecycle in graph data pipeline.

---

## 9. Definition of Done for lifecycle quality

A feature is complete only when:
1. all lifecycle states are explicit,
2. refresh behavior is deterministic,
3. error state has recovery path,
4. reset path removes residue,
5. QA can run happy/failure/recovery scripts and reach expected state each time.
