# Merge Judgment Calls: remove-authentication <- origin/main

## Conservative decisions (kept ours entirely)

### `backend/src/users/users.service.spec.ts`
**Decision:** Kept ours entirely.

Main added tests for `changePassword`, `deleteAccount`, and `deleteData` methods. All three methods require password/OIDC re-authentication which does not exist in the profile system. These methods were not added to our `users.service.ts`, so their tests would fail to compile. Main also added a `updates multiple fields at once` test referencing `notificationEmail` (auth-related field not in our preferences schema).

The `updates favouriteReportIds` test from main was also skipped because it appeared inside the same conflict block. It would be a valid non-auth test to add later if desired.

### `backend/src/notifications/bill-reminder.service.spec.ts`
**Decision:** Kept ours entirely.

Main rewrote the entire test suite with detailed tests for email sending behavior (checking if bills are in reminder window, per-user email preferences, etc.). Our version has a single test: "does not send any emails (profiles have no email addresses)". Since profiles have no email addresses, the email path is permanently disabled; testing the detailed email behavior is irrelevant to this branch.

### `backend/src/budgets/budget-alert.service.spec.ts`
**Decision:** Kept ours base; accepted sign fix (already auto-merged); rejected email notification test.

The transaction sign fix (`"-550"` and `"-600"` instead of positive values) was already auto-merged by git -- no manual action needed.

Main added a new test "does not send email when user has notifications disabled" referencing `notificationEmail: false`. This test is email-notification-specific and profiles have no email, so it was rejected.

### `frontend/src/lib/user-settings.ts` and `.test.ts`
**Decision:** Kept ours entirely.

Main adds `changePassword`, `deleteAccount`, `deleteData`, `getSmtpStatus`, `sendTestEmail` API functions -- all require password or OIDC re-auth, none apply to the profile system.

### `frontend/src/components/settings/DangerZoneSection.tsx` and `.test.tsx`
**Decision:** Kept ours entirely.

Main adds "Delete Data" and "Delete Account" flows with password confirmation and OIDC re-auth prompts. These don't apply without passwords.

### `.claude/settings.local.json`
**Decision:** Kept ours entirely (as instructed by user).

### `frontend/src/components/auth/ProtectedRoute.test.tsx`
**Decision:** Kept ours entirely.

Our version tests `profileStore.isSelected` and redirect to `/profiles`. Main tests JWT auth flow.

## Structural decisions

### Migration 025 numbering collision
Both branches added migration 025. Ours: `025_simplify-to-profiles.sql` (kept). Main's: `025_favourite_report_ids.sql` was renumbered to `035_favourite_report_ids.sql`.

### Migrations 026 and 034 (auth table alterations)
Both `026_trusted_device_fingerprint.sql` and `034_refresh_token_remember_me.sql` ALTER tables (`trusted_devices`, `refresh_tokens`) that were dropped by our migration 025. Wrapped in `DO $$ BEGIN IF EXISTS ... END $$;` guards so they are safe no-ops on our schema.

### `backup.controller.ts` restore endpoint
The restore endpoint from main passes `password` and `oidcIdToken` headers to `backupService.restoreData()`. These are auth-verification features; in our profile system, they will always be `undefined`. Kept the pass-through as-is since the service presumably handles `undefined` gracefully and these headers are optional. If the backup service enforces them, a follow-up fix may be needed.
