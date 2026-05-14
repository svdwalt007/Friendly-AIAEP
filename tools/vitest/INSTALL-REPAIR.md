# Local install repair — Windows native bindings

If `pnpm nx run <project>:test` or direct `vitest` invocations fail with
either of these errors:

- `TypeError: WorkspaceContext is not a constructor`  ← Nx native binding missing
- `Cannot find module '@rolldown/binding-win32-x64-msvc'`  ← Vite/rolldown native binding missing
- `Cannot find module './rolldown-binding.win32-x64-msvc.node'`

…then your `node_modules` is missing platform-specific binaries. This is the
[npm optional-deps bug](https://github.com/npm/cli/issues/4828) — `pnpm` inherits
the same symptom when the lockfile was generated on a different platform.

## Fix (Windows)

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force pnpm-lock.yaml   # only if the lockfile was generated on another OS
pnpm install
```

If you cannot delete the lockfile (e.g. PR review constraints), the lighter
fix is to force-reinstall the platform binaries directly:

```powershell
pnpm install --force @nx/nx-win32-x64-msvc @rolldown/binding-win32-x64-msvc
```

## Verify

```powershell
pnpm exec nx run shared-cache:test
pnpm exec nx run aep-api-gateway:test
```

Both should run vitest cleanly.

## Why this happens

`@nx/nx-win32-x64-msvc` and `@rolldown/binding-win32-x64-msvc` are listed in
`optionalDependencies` of `nx` and `rolldown` respectively, but npm's lockfile
resolution has a long-standing bug where the platform key for these optional
deps gets pinned to whatever OS first wrote the lockfile. When a different OS
later runs `pnpm install --frozen-lockfile`, it skips the binaries it needs.

There is nothing project-specific to fix — it's purely an install-time
artefact. The instructions above are the standard remediation.
