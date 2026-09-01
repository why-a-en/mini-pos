## Git workflow

**Two long-lived branches**, no version tags — this is a continuously-deployed
app, not a versioned release:

- **`dev`** — the default branch and integration target. Deploys to the
  **staging** environment. Every feature branch opens its PR here.
- **`main`** — production. Only ever updated by a **`dev` → `main` PR**
  ("release"). Vercel's Production Branch is pinned to `main`, so a merge
  here is a production deploy.

Rules:

- Work happens on short-lived branches off `dev`, prefixed by type:
  `feat/…`, `fix/…`, `chore/…` (e.g. `feat/order-status`, `fix/image-upload`).
- Open a PR **into `dev`** to get a Vercel Preview URL automatically; review
  the diff and the live preview, then merge. Don't push directly to `dev`
  or `main`.
- **Release:** open a PR from `dev` to `main` when staging is good. Keep it
  a plain merge (no squash) so `main`'s history stays a subset of `dev`'s.
- **Hotfix:** branch off `main`, PR back into `main`, then immediately
  merge `main` back down into `dev` (or cherry-pick) so the two don't
  diverge.
- Merged PR branches auto-delete (repo setting). `prototype/*` branches are
  kept deliberately — see the note on Claude Code worktrees below.
- Neon creates a database branch per git branch/PR automatically (via the
  Vercel integration), so schema migrations in a PR run against an isolated
  DB branch, never against production data.

## UI conventions

This is a **phone app first** (375px design width, `--content-max` 520px).
It should feel like an app you installed, not a page you loaded. The design
system itself — tokens, density rules, the monochrome palette — lives in
`src/styles/tokens/*.css`; the component kit that implements it is
`src/components/ui/`. Two rules are easy to break and are checked in review:

### Every nested screen has a back button

If a screen is not one of the role's tab-bar destinations, it **must** offer
a way back in its `TopBar`. There is no browser chrome to fall back on.

- `<TopBar brand …>` — a top-level tab destination; leads with the mark.
- `<TopBar backHref="/orders" …>` — a pushed screen; leads with a back
  arrow. Use this for anything reached by tapping into something: record
  detail pages, forms, and the Home-shortcut screens (`/customers`,
  `/products`, `/parcels`, `/unsourced`), which are not tabs.
- `<TopBar onBack={…} …>` — same, when back means "step within this screen"
  (a wizard step, closing a sub-picker) rather than a route change.

`brand` and back are mutually exclusive by design. Back must always resolve
to *something*: a conditional `onBack` that can be `undefined` strands the
screen — pair it with a `backHref` fallback rather than dropping the button.

### Every press is felt

The system is monochrome, so press cannot be signalled with colour — it is
signalled with **movement and fill**, and it must fire on touch, not only on
hover. Rules:

- Never rely on `hover:` alone for press feedback. A touch produces no
  hover, so state the `active:` variant explicitly.
- Buttons and compact controls scale down: `active:scale-[0.985]` for
  full-size buttons, `active:scale-95` for icon targets, `active:scale-90`
  for the small circular ones. Full-bleed list rows highlight instead
  (`active:bg-surface-hover`) — scaling something pinned to both screen
  edges reads as a glitch.
- Transition through the motion tokens (`duration-fast`/`duration-instant`
  + `ease-standard`), never a raw ms value.
- Keep the native mobile defaults suppressed — the tap-highlight flash,
  the 300ms double-tap delay, and long-press text selection on controls are
  cleared once, globally, in `src/app/globals.css`. Don't reintroduce them
  per component.
- Reach for the kit rather than a bare `<button>`: `Button`, `IconButton`,
  `Row`, and `Toggle` already carry the correct press, focus-visible ring,
  and disabled behaviour.

## Agent skills

### Issue tracker

Issues live as GitHub issues; skills use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five canonical triage labels as-is (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
