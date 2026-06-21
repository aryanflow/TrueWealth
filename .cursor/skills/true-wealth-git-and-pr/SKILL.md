---
name: true-wealth-git-and-pr
description: >-
  Git commit and GitHub PR conventions for the True Wealth repository. Use when
  the user asks to commit, draft a commit message, create a pull request, or
  run gh pr against this repo; or when deciding whether to commit unpushed
  work.
---

# True Wealth — git and PRs

## Commits

- **Create commits only when the user explicitly asks** to commit (or their rules say so). Do not commit proactively.
- **Never** change `git config`, use destructive git commands, `--no-verify`, skip hooks, or force-push to `main`/`master` unless they explicitly request it.
- **Avoid `git commit --amend`** except when their rules allow (explicit amend, your commit only, not pushed).
- If commit fails on a hook, fix and make a **new** commit; do not amend a failed hook commit.
- Do not stage secrets (`.env`, raw tokens). Warn if they ask to commit those files.

When they do ask to commit: run `git status`, `git diff`, `git log` for style, draft message, `git add`, commit with heredoc message, `git status` to confirm.

## Pull requests (`gh`)

When they ask for a PR: parallel `git status`, `git diff`, remote/branch sync check, `git log` and `git diff <base>...HEAD`, then branch/push if needed, **`gh pr create`** with heredoc body (Summary + Test plan), return the PR URL. Do not `git config`; do not push unless needed for the PR.

## Repo context

True Wealth: personal portfolio dashboard; keep commit/PR copy factual and scoped to the change.
