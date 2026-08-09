---
name: github-ci-reviewer
description: Monitor a pushed commit's GitHub Actions run, diagnose and repair CI failures, repeat local validation and pushes within a bounded retry limit, and open a pull request after CI succeeds. Use after pushing a non-protected branch when CI should be reviewed asynchronously, when a failed workflow should be repaired, or when a successful run should lead to a pull request.
---

# GitHub CI Reviewer

Monitor one exact pushed commit at a time. Use Codex Desktop scheduling for wakeups and `gh` for GitHub state; never infer CI success from local tests alone.

## Establish the review target

1. Read the repository instructions and test commands before changing anything.
2. Confirm the working tree, current branch, upstream remote, target PR branch, workflow name or file, and repair-attempt limit. Default the limit to three.
3. Do not operate directly on a protected or default branch. Require a pushed feature or development branch.
4. Record the repository, branch, and exact pushed commit:

```bash
gh repo view --json nameWithOwner
git branch --show-current
git rev-parse HEAD
```

Use the recorded SHA for every lookup. Do not select a run only because it is the newest run in the repository.

## Start scheduled monitoring

After a successful push, create a Codex Desktop heartbeat attached to the current task. Check every two minutes unless the user specifies another interval. Put these values in the heartbeat prompt:

- absolute repository path
- GitHub repository
- workflow name or file
- branch and pushed commit SHA
- target PR branch
- current repair-attempt count

Use the product's scheduling capability, not a handwritten cron process or a long blocking sleep. If scheduling is unavailable, report that limitation and offer a foreground `gh run watch --exit-status` fallback. Never claim a schedule was created when it was not.

## Inspect the exact workflow run

On each wakeup, run a non-interactive lookup such as:

```bash
gh run list --workflow WORKFLOW --branch BRANCH --commit SHA --limit 10 \
  --json databaseId,status,conclusion,headSha,url,workflowName
```

Handle the result as follows:

- **No matching run:** keep monitoring briefly while GitHub accepts the event. If none appears after five minutes, inspect the workflow trigger and report the blocker.
- **Queued or in progress:** keep the heartbeat active and make no code change.
- **Successful:** continue to the pull-request step.
- **Failed, timed out, cancelled, stale, or action required:** inspect metadata and failed logs with `gh run view RUN_ID --json ...` and `gh run view RUN_ID --log-failed`.

If multiple matching runs exist, select the run for the recorded workflow, branch, event, and SHA. Report the run URL used as evidence.

## Repair a failed run

1. Distinguish code or configuration failures from missing permissions, secrets, service outages, cancelled runs, and flaky infrastructure.
2. For a fixable repository failure, identify the smallest causal change. Preserve unrelated user changes.
3. Never delete tests, weaken assertions, relax required checks, update snapshots without cause, force-push, or rewrite shared history.
4. Run the repository's required local checks. Do not push a fix that fails locally unless the failure cannot run outside CI and is clearly documented.
5. Review the diff, commit only the scoped fix, and push the same branch.
6. Record the new SHA, increment the attempt count, and continue monitoring the new run.

Stop after three failed repair attempts unless the user set a lower limit. Also stop for missing authorization, unavailable secrets, destructive changes, uncertain requirements, or failures outside the repository. Disable the heartbeat and report the run URL, evidence, attempted fixes, and remaining blocker.

## Open or update the pull request

After the pushed commit succeeds:

1. Check for an existing pull request with the same head and target branches.
2. Create a pull request only when none exists and the user authorized PR creation. Include a concise summary and the checks run.
3. If pull-request creation triggers another workflow, keep monitoring that PR check. Repair failures on the head branch within the same attempt limit.
4. Stop and disable the heartbeat when the PR checks pass. Return the PR URL, final commit SHA, workflow URL, and validation summary.

Do not merge the pull request unless the user explicitly requests it.

## Report every terminal outcome

Include the monitored branch and SHA, workflow and run URL, conclusion, repair-attempt count, changed files, local checks, schedule status, and PR URL or blocker.
