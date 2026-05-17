# Project-scoped guidance — Friendly-AIAEP

This file augments the root `CLAUDE.md` (the Nx-driven team baseline). It tells Claude how to **work** in this repo.

> Working branch: `main` · Stack: **Nx monorepo, Angular, Playwright, Vitest, Storybook, Verdaccio**

## How to approach changes

1. **Always go through `nx`.** `nx run`, `nx run-many`, `nx affected`. Don't invoke the underlying Angular/Vitest/Playwright CLIs directly — that bypasses Nx caching and project boundaries.
2. **Invoke `nx-workspace` first** for any structural query (which projects exist, what targets, what dependencies). Faster and more accurate than guessing.
3. **Invoke `nx-generate` for scaffolding** — never hand-roll new apps/libs. Generators handle `project.json`, tsconfig paths, lint config, and CI wiring.
4. **Don't add new top-level folders** without running them through Nx. Tree-shaking, lint, and Playwright project discovery all depend on the workspace structure.

## Existing rules (load-bearing)

`.claude/rules/port-security-guidelines.md` is binding for any deployment / docker-compose / nginx change:

- High-port ranges only — UI 45000-45999, API 46000-46999, DB 47000-47999, MQ 48000-48999, observability 49000-49999.
- Reverse-proxy public 443 → private high port; never expose high ports to the public internet directly.
- Ports must be env-configurable; document changes in `PORT-ALLOCATION.md` (create the file when allocating new ports if absent).

`.claude/hooks/` and `.claude/rules/` are read by the harness — read them before committing if they've been updated.

## Skills to invoke

- `nx-workspace`, `nx-generate` — first thing for ANY structural query or scaffolding work.
- `ui-ux-pro-max`, `ckmui-styling` — for component/UX work.
- `friendly-branding`, `ckmbrand`, `ckmdesign-system` — for any branded artefact (slides, banners, customer-facing surfaces).
- `tdd-workflow` — for new application logic.
- `security-review` — for auth, env handling, credential boundaries.
- `mcp-server-patterns` — only when introducing/modifying an MCP integration.

## Verification before claiming "done"

```bash
# Affected first — much faster than full
nx affected --target=lint
nx affected --target=test
nx affected --target=build

# E2E (Playwright)
npm run test:e2e             # or scoped: npm run test:e2e:chromium
npm run test:visual          # Percy visual regression
npm run test:components      # Playwright component tests

# Storybook
npx nx run <project>:storybook
```

For UI work, open the app or Storybook in a real browser. Type-check + unit tests are not sufficient for visual or accessibility changes.

## Sub-agent patterns

- "Where is X used / which projects depend on Y" — start with `nx graph` before grepping.
- For multi-project edits — Plan agent to enumerate affected projects, then TodoWrite the file list.

## Sensitive files / never edit casually

- `.env`, `.env.development`, `.env.preprod`, `.env.production`, `.env.test`, `.env.bak` — never read aloud, never commit secrets, never echo to logs.
- `.verdaccio/` — local registry; only edit when intentionally changing publish flow.
- `.angular/`, `.nx/` — caches; never commit, never edit.
- `*.theia-workspace` — IDE state.
- `package-lock.json` — keep in sync via `npm install`, don't hand-edit.

## Commit style

Conventional commits, scope by Nx project where possible:
- `feat(<project>): ...`
- `fix(<project>): ...`
- `chore(workspace): ...` for cross-cutting plumbing

Don't bypass git hooks (`--no-verify`). If a hook fails, fix the underlying issue.
