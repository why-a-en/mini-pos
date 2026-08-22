## Git workflow

**GitHub Flow** (trunk-based) — not Gitflow. No `develop`/`release`/`hotfix`
branches, no version tags; this is a continuously-deployed app, not a
versioned release.

- `main` is always deployable; Vercel auto-deploys it to production on merge.
- Work happens on short-lived branches off `main`, prefixed by type:
  `feat/…`, `fix/…`, `chore/…` (e.g. `feat/order-status`, `fix/image-upload`).
- Open a PR to get a Vercel Preview URL automatically; review the diff and
  the live preview, then merge — don't push directly to `main` once more
  than one person is committing.
- Hotfixes are just another branch off `main`; there's no separate hotfix flow.
- Neon creates a database branch per git branch/PR automatically (via the
  Vercel integration), so schema migrations in a PR run against an isolated
  DB branch, never against production data.

## Agent skills

### Issue tracker

Issues live as GitHub issues; skills use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five canonical triage labels as-is (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
