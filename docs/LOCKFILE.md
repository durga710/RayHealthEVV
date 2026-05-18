# package-lock.json — Cross-Platform Workflow

## TL;DR

- **Don't run `rm package-lock.json && npm install` on macOS.** It silently strips Linux native binding entries that the CI runners need, and `npm ci` then fails with `Missing @rolldown/binding-linux-x64-gnu@…`.
- **If you must regenerate, use Docker:** `./scripts/sync-lockfile.sh` (runs `npm install` inside `node:22-bookworm-slim` on `linux/amd64`).
- **CI has a safety net:** the `lockfile-sync` GitHub Action regenerates the lockfile on every PR that touches `package.json` and auto-commits the fix.

## Why this matters

The build chain pulls packages that ship native binaries — `rolldown`, `esbuild`, `swc`, `sharp`, etc. Each one declares its platform-specific binaries as `optionalDependencies` and gates them by `os` / `cpu`. When npm installs:

1. It walks the `optionalDependencies` tree.
2. For each entry, it reads the candidate's own `package.json`.
3. If the candidate's `os` / `cpu` doesn't match the **current** machine, npm **silently** skips it AND drops the resolution entry from `package-lock.json`.
4. The lockfile no longer reflects the union of platforms anyone might install on.

Result: a developer regenerates `package-lock.json` on macOS-arm64, commits it, opens a PR. Linux x86_64 CI runs `npm ci`, which is strict about lockfile/package.json alignment, sees `@rolldown/binding-linux-x64-gnu` listed in `optionalDependencies` but not in the lockfile tree, and aborts with `Missing X from lock file`.

This is documented upstream as [npm/cli#4828](https://github.com/npm/cli/issues/4828) and has been "intentional design, won't fix" since 2022.

## Workflow

### Local dev — Day-to-day

- `npm install` is fine for adding/removing a single package on your machine. It does a minimal lockfile update; cross-platform entries already present stay put.
- Commit the resulting lockfile changes alongside the `package.json` change.

### Local dev — When a teammate hits "Missing X from lock file" in CI

```bash
./scripts/sync-lockfile.sh
git add package-lock.json
git commit -m "chore: sync package-lock.json on linux/amd64"
git push
```

Requires Docker Desktop (or any Docker daemon) running. The script:

1. Pulls `node:22-bookworm-slim` with `--platform=linux/amd64`.
2. Mounts the repo into the container.
3. Runs `npm install --legacy-peer-deps --no-audit --no-fund --package-lock-only` inside.
4. Reports the diff.

The `--package-lock-only` flag means **only the lockfile is regenerated** — your `node_modules` is untouched. Fast (~1 minute on a warm Docker pull).

### CI safety net — `lockfile-sync` workflow

`.github/workflows/lockfile-sync.yml` runs on every PR that modifies `package.json` or `package-lock.json`. It:

1. Checks out the PR branch.
2. Runs the same `npm install --package-lock-only` on ubuntu-latest.
3. If the lockfile would change:
   - **Same-repo PR:** commits the fix back to the PR branch as `github-actions[bot]`. Note that GitHub's default `GITHUB_TOKEN` does **not** re-trigger downstream workflows; you'll need to push any commit (or close-reopen the PR) for the main CI to re-run.
   - **Forked PR:** drops a comment with instructions, since the bot can't push to forks.

To bypass the "doesn't re-trigger CI" limitation, configure a PAT in the `LOCKFILE_SYNC_TOKEN` repository secret. The workflow prefers that over `GITHUB_TOKEN` automatically.

## Alternatives we considered

| Approach | Why we didn't use it |
|---|---|
| `pnpm` migration | Solves the problem at the lockfile-design level (pnpm records cross-platform entries by default). But: touches every CI file, Vercel config, every developer's machine, and changes hoisting semantics. Worth revisiting if `npm` keeps biting us. |
| `bun` install | Same reasoning as pnpm + bun's npm-compat layer still has edge cases. |
| `npm install --os=linux --cpu=x64` | npm 10+ supports it, but each invocation overwrites the lockfile — you'd need to chain installs for every platform and merge by hand. |
| Hand-edit the lockfile | Brittle. Breaks on the next install. |
| Commit `node_modules` | Please no. |

If `npm/cli#4828` ever gets resolved, this whole document goes away and we delete the workflow.
