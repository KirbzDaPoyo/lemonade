# Release 0.2 verification record

Verification date: 2026-09-08
Candidate branch: `feature/release-0.2-ci-docs`

## Automated verification

| Check | Result |
| --- | --- |
| Locked dependency installation | Passed: `npm ci` completed from `package-lock.json` |
| Regression suite | Passed: 73 tests, 0 failures |
| TypeScript | Passed: `tsc --noEmit` |
| Expo Doctor | Passed: 18/18 checks |
| Android JavaScript production bundle | Passed: Expo export produced an Android Hermes bundle |
| GitHub Actions CI | Passed: branch push run #1 completed successfully |
| Git diff and secret/artifact audit | Passed: no whitespace errors, secret matches, or tracked generated/internal-tool artifacts |
| Production dependency registry audit | Recorded debt: 36 moderate and 12 high transitive findings; no non-breaking complete fix is currently offered |
| Supabase security advisor after deletion migration | Passed: zero findings |
| Rollback-only two-user deletion isolation | Passed: current subject deleted; other subject preserved |

GitHub Actions repeats the locked install, regression suite, and type-checking without secrets, provider calls, EAS builds, or deployments.

## Android acceptance evidence

The repository owner completed device acceptance throughout the sequential 0.2 work packages:

| Area | Result |
| --- | --- |
| Synthetic Editorial visual system, light/dark/system modes, and preference persistence | Passed |
| Expo Router navigation, page transitions, visible Back controls, and Android hardware Back | Passed |
| Incoming-share/manual-add routing and import-state reset | Passed |
| Anchored filter menu, larger tag collections, filtering, and saved-list refresh repair | Passed |
| Instagram import, candidate selection before save, wrong-selection recovery, and save confirmation | Passed |
| Status, favorite heart, notes, tag assignment, tag-library editing, and external links | Passed |
| PostHog expected events with Session Replay disabled | Passed |
| Sentry unexpected-failure reporting and environment context | Passed |
| Versioned JSON export, Android share sheet, portable fields, and non-ASCII text | Passed |
| Exact confirmation guard and cancellation without data loss | Passed |
| Complete deletion of a disposable account, followed by successful access to the unaffected primary account | Passed |
| Public deletion instructions rendered locally and reviewed | Passed |

The Google Places “top result” label is advisory and is not guaranteed to be the correct candidate. Release 0.2 requires deliberate candidate selection, not perfect ranking.

## Open verification debt

These items are recorded rather than represented as passed:

- Production dependency advisories reported through the Expo/Metro, Clerk, PostHog, and routing trees. Reassess during the next compatible Expo/dependency upgrade; do not apply npm's suggested breaking downgrades or forced fixes to this release branch.
- Physical iOS navigation, share extension, export destination, and account-deletion testing.
- Android large-font and screen-reader accessibility passes.
- A manually induced Supabase-success/Clerk-failure partial deletion. Automated tests cover the control-flow requirement, and the UI exposes identity-deletion retry without recreating data.
- Production store build, signing, submission, and rollout.
- Deployment of the public deletion page and configuration of its store-listing URL.

## Release conclusion

Release 0.2 is an Android-validated engineering candidate. The remaining debt above is required input for store-release planning; it does not authorize a production deployment.
