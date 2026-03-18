# Merge Plan: `remove-authentication` <- `origin/main`

## Overview

**Goal:** Merge all new features from `origin/main` into the `remove-authentication` branch while preserving:
1. The profile-based auth system (no JWT/OIDC/2FA/CSRF/passwords)
2. The custom default-categories list (uncommitted changes in `backend/src/categories/default-categories.ts`)

**Merge base:** `331d761` (the commit where `remove-authentication` diverged from main)

**Branch commit:** `d0515c5` ("Successfully removed authentication from the build") -- single commit on top of merge base

**Conflict summary:** ~48 conflicting files in 3 groups:
- 20+ modify/delete conflicts (auth files we deleted, main modified)
- 6 file-location conflicts (new auth files main added, git misplaced into `ai/`)
- 20+ content conflicts (both sides changed the same file)

---

## Phase 0: Preparation

**Do this before running `git merge`.**

```bash
# 1. Save uncommitted default-categories changes
git stash push -m "custom-default-categories" -- backend/src/categories/default-categories.ts

# 2. Create a safety backup branch
git branch remove-authentication-backup

# 3. Verify clean working tree
git status
```

---

## Phase 1: Start the merge and bulk-resolve deletions

This phase handles the straightforward conflicts where our branch deleted files that main modified. All of these are auth-system files that we intentionally removed.

```bash
# Start the merge (will halt with conflicts)
git merge origin/main
```

### 1a. Remove auth backend files (deleted by us, expanded by main)

```bash
git rm -rf backend/src/auth/
git rm -rf backend/src/admin/
```

### 1b. Remove misplaced auth files (git rename heuristic put them in ai/)

Main added `auth-email.service`, `token.service`, and `two-factor.service` inside `backend/src/auth/`. Since our branch deleted that directory, git thinks it was "renamed" to `backend/src/ai/` and places these new files there. They are all part of the auth system and must be discarded.

```bash
git rm -f backend/src/ai/auth-email.service.ts backend/src/ai/auth-email.service.spec.ts 2>/dev/null || true
git rm -f backend/src/ai/token.service.ts backend/src/ai/token.service.spec.ts 2>/dev/null || true
git rm -f backend/src/ai/two-factor.service.ts backend/src/ai/two-factor.service.spec.ts 2>/dev/null || true
```

### 1c. Remove CSRF guard and interceptor (deleted by us)

```bash
git rm -f backend/src/common/guards/csrf.guard.ts backend/src/common/guards/csrf.guard.spec.ts 2>/dev/null || true
git rm -f backend/src/common/interceptors/csrf-refresh.interceptor.ts backend/src/common/interceptors/csrf-refresh.interceptor.spec.ts 2>/dev/null || true
```

### 1d. Remove frontend auth pages (deleted by us)

```bash
git rm -rf frontend/src/app/login/
git rm -rf frontend/src/app/register/
git rm -rf frontend/src/app/forgot-password/
git rm -rf frontend/src/app/reset-password/
git rm -rf frontend/src/app/change-password/
git rm -rf frontend/src/app/auth/
```

### 1e. Remove frontend auth components (deleted by us)

```bash
git rm -f frontend/src/components/settings/SecuritySection.tsx
git rm -f frontend/src/components/settings/SecuritySection.test.tsx
git rm -f frontend/src/components/settings/NotificationsSection.tsx
git rm -f frontend/src/components/settings/NotificationsSection.test.tsx
git rm -f frontend/src/components/settings/ApiAccessSection.tsx
git rm -f frontend/src/components/settings/ApiAccessSection.test.tsx
git rm -f frontend/src/store/authStore.ts
git rm -f frontend/src/store/authStore.test.ts
git rm -f frontend/src/lib/admin.ts
```

---

## Phase 2: Accept new features from main

These are new files/directories from main that don't conflict. They contain new features we want.

### 2a. New backend modules

```bash
git checkout origin/main -- backend/src/tags/
git checkout origin/main -- backend/src/backup/
```

**Post-checkout fix required:** Both `tags.controller.ts` and `backup.controller.ts` use `@UseGuards(AuthGuard("jwt"))`. Change to `@UseGuards(SessionGuard)` and update imports:
- Remove: `import { AuthGuard } from "@nestjs/passport";` and `@ApiBearerAuth()`
- Add: `import { SessionGuard } from "../common/guards/session.guard";`

Files to edit:
- `backend/src/tags/tags.controller.ts`
- `backend/src/backup/backup.controller.ts`

### 2b. New import parsers and entities

```bash
git checkout origin/main -- backend/src/import/csv-parser.ts
git checkout origin/main -- backend/src/import/csv-parser.spec.ts
git checkout origin/main -- backend/src/import/ofx-parser.ts
git checkout origin/main -- backend/src/import/ofx-parser.spec.ts
git checkout origin/main -- backend/src/import/entities/
```

### 2c. New frontend feature files

```bash
git checkout origin/main -- frontend/src/app/tags/
git checkout origin/main -- frontend/src/components/tags/
git checkout origin/main -- frontend/src/lib/tags.ts
git checkout origin/main -- frontend/src/lib/backupApi.ts
git checkout origin/main -- frontend/src/lib/pdf-export.ts
git checkout origin/main -- frontend/src/lib/pdf-export-charts.ts
git checkout origin/main -- frontend/src/lib/pdf-export-charts.test.ts
git checkout origin/main -- frontend/src/lib/pdf-export-tables.ts
git checkout origin/main -- frontend/src/lib/pdf-export-tables.test.ts
git checkout origin/main -- frontend/src/lib/pdf-export.test.ts
git checkout origin/main -- frontend/src/lib/csv-export.ts
git checkout origin/main -- frontend/src/lib/constants.ts
git checkout origin/main -- frontend/src/lib/zod-helpers.ts
git checkout origin/main -- frontend/src/components/settings/BackupRestoreSection.tsx
git checkout origin/main -- frontend/src/components/settings/BackupRestoreSection.test.tsx
git checkout origin/main -- frontend/src/components/ui/ExportDropdown.tsx
git checkout origin/main -- frontend/src/components/ui/ExportDropdown.test.tsx
git checkout origin/main -- frontend/src/components/payees/MergePayeeDialog.tsx
git checkout origin/main -- frontend/src/components/payees/MergePayeeDialog.test.tsx
git checkout origin/main -- frontend/src/components/payees/PayeeAliasManager.tsx
git checkout origin/main -- frontend/src/components/payees/PayeeAliasManager.test.tsx
git checkout origin/main -- frontend/src/components/securities/SecurityPriceForm.tsx
git checkout origin/main -- frontend/src/components/securities/SecurityPriceForm.test.tsx
git checkout origin/main -- frontend/src/components/securities/SecurityPriceHistory.tsx
git checkout origin/main -- frontend/src/components/securities/SecurityPriceHistory.test.tsx
git checkout origin/main -- frontend/src/components/dashboard/FavouriteAccounts.tsx
git checkout origin/main -- frontend/src/components/dashboard/FavouriteAccounts.test.tsx
git checkout origin/main -- frontend/src/components/accounts/AccountExportModal.tsx
git checkout origin/main -- frontend/src/components/accounts/AccountExportModal.test.tsx
git checkout origin/main -- frontend/src/components/import/CsvColumnMappingStep.tsx
git checkout origin/main -- frontend/src/components/import/CsvColumnMappingStep.test.tsx
git checkout origin/main -- frontend/src/components/import/CsvTransferRules.tsx
git checkout origin/main -- frontend/src/components/import/CsvTransferRules.test.tsx
git checkout origin/main -- frontend/src/components/import/MultiAccountReviewStep.tsx
git checkout origin/main -- frontend/src/components/import/MultiAccountReviewStep.test.tsx
git checkout origin/main -- frontend/src/components/layout/HttpWarningBanner.tsx
git checkout origin/main -- frontend/src/components/layout/HttpWarningBanner.test.tsx
git checkout origin/main -- frontend/src/types/tag.ts
```

### 2d. New database migrations (025-034 from main)

Accept all new migrations. Our branch already has `025_simplify-to-profiles.sql` which takes number 025. Main's migrations start at 025 too, creating a numbering collision.

**Strategy:** Keep our `025_simplify-to-profiles.sql`. Renumber main's `025_favourite_report_ids.sql` to `035`:

```bash
# Accept migrations 026-034 as-is
git checkout origin/main -- database/migrations/026_trusted_device_fingerprint.sql
git checkout origin/main -- database/migrations/027_credit_card_date_options.sql
git checkout origin/main -- database/migrations/028_credit_card_statement_fields_constraint.sql
git checkout origin/main -- database/migrations/029_share_price_6_decimals.sql
git checkout origin/main -- database/migrations/030_import_column_mappings.sql
git checkout origin/main -- database/migrations/031_payee_aliases.sql
git checkout origin/main -- database/migrations/032_tags.sql
git checkout origin/main -- database/migrations/033_scheduled_transaction_tag_ids.sql
git checkout origin/main -- database/migrations/034_refresh_token_remember_me.sql
```

Then create `035_favourite_report_ids.sql` with the content of main's 025:

```sql
-- Add favourite_report_ids column to user_preferences for persisting built-in report favourites
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS favourite_report_ids TEXT[] DEFAULT '{}';
```

**Auth table migrations that need `IF EXISTS` guards:**

Two migrations from main ALTER tables that our branch dropped (`trusted_devices`, `refresh_tokens`). They need to become safe no-ops on our schema:

- `026_trusted_device_fingerprint.sql` -- currently does `ALTER TABLE trusted_devices ADD COLUMN ...`
  - Wrap in: `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trusted_devices') THEN ALTER TABLE trusted_devices ADD COLUMN IF NOT EXISTS user_agent_hash VARCHAR(64); END IF; END $$;`

- `034_refresh_token_remember_me.sql` -- currently does `ALTER TABLE refresh_tokens ADD COLUMN ...`
  - Same pattern: wrap in `IF EXISTS` check for `refresh_tokens` table

---

## Phase 3: Manual content conflict resolution (backend)

These files have real content conflicts where both sides made changes. Each needs manual editing.

### 3a. `backend/src/main.ts`

**Current (our branch):** `cookieParser(process.env.COOKIE_SECRET || "default-dev-secret-change-in-production")`
**Main adds:** backup restore raw body parser, `DISABLE_HTTPS_HEADERS` conditional for helmet, production null-origin CORS rejection, HTTP server timeout extension, auth-only CORS headers

**Resolution:** Start from main's version, then apply these changes:

1. Replace `app.use(cookieParser())` with:
   ```typescript
   app.use(cookieParser(process.env.COOKIE_SECRET || "default-dev-secret-change-in-production"));
   ```

2. Remove auth-only CORS headers from `allowedHeaders`. Keep only:
   ```typescript
   allowedHeaders: ["Content-Type", "Authorization", "Accept", "Mcp-Session-Id"],
   ```
   (Remove `X-CSRF-Token`, `X-Restore-Password`, `X-Restore-OIDC-Token`)

3. Keep everything else from main:
   - The backup restore raw body parser (`app.use("/api/v1/backup/restore", express.raw(...))`)
   - The `DISABLE_HTTPS_HEADERS` conditional in helmet config
   - The production null-origin CORS rejection
   - The server timeout block at the end

### 3b. `backend/src/app.module.ts`

**Resolution:** Keep our branch's version as the base. Add only the two new feature module imports:

Add imports at the top:
```typescript
import { TagsModule } from "./tags/tags.module";
import { BackupModule } from "./backup/backup.module";
```

Add to the `imports` array (after `BudgetsModule`):
```typescript
TagsModule,
BackupModule,
```

Do NOT add: `AuthModule`, `AdminModule`. Do NOT add to providers: `CsrfGuard`, `MustChangePasswordGuard`, `PatScopeGuard`, `CsrfRefreshInterceptor`.

### 3c. `backend/src/import/import.controller.ts`

**Resolution:** Take main's version entirely (it has all the CSV/OFX endpoints we want), then fix the guard:

1. Remove: `import { AuthGuard } from "@nestjs/passport";`
2. Add: `import { SessionGuard } from "../common/guards/session.guard";`
3. Replace: `@UseGuards(AuthGuard("jwt"))` with `@UseGuards(SessionGuard)`
4. Remove: `@ApiBearerAuth()` decorator

### 3d. `backend/src/users/users.service.ts`

**Resolution:** Keep our branch's version entirely. Then add only `favouriteReportIds` handling.

Add to `updatePreferences` method (after the `budgetDigestDay` block, before the `return`):
```typescript
if (dto.favouriteReportIds !== undefined) {
  preferences.favouriteReportIds = dto.favouriteReportIds;
}
```

### 3e. `backend/src/users/users.controller.ts`

**Resolution:** Keep our branch's version entirely. No changes needed.

### 3f. `backend/src/users/dto/update-preferences.dto.ts`

**Resolution:** Keep our branch's version. Add `favouriteReportIds` field with validators:

```typescript
@IsOptional()
@IsArray()
@IsString({ each: true })
@MaxLength(100, { each: true })
@Matches(/^[a-z0-9-]+$/, { each: true, message: 'Report IDs must be lowercase alphanumeric with hyphens' })
@ArrayMaxSize(100)
favouriteReportIds?: string[];
```

Add missing imports: `IsArray`, `ArrayMaxSize`, `Matches` from `class-validator`.

### 3g. `backend/src/users/entities/user-preference.entity.ts`

**Resolution:** Keep our branch's version. Add `favouriteReportIds` column:

```typescript
@Column({
  name: "favourite_report_ids",
  type: "text",
  array: true,
  default: "{}",
})
favouriteReportIds: string[];
```

### 3h. `backend/src/users/users.service.spec.ts`

**Resolution:** Keep our branch's version as the base. Accept only bug fixes from main that are not auth-related. Main's test changes mostly involve auth methods (`changePassword`, `deleteAccount`, `deleteData`) which we don't have. Inspect the diff for any non-auth test fixes.

### 3i. `backend/src/users/users.controller.spec.ts`

**Resolution:** Keep our branch's version entirely. Main's changes add auth-related endpoint tests.

### 3j. `backend/src/budgets/budget-alert.service.spec.ts`

**Resolution:** Keep our branch's version as the base. Accept only the transaction sign fix from main:
- Change test data transaction totals from `"550"` to `"-550"` and `"600"` to `"-600"` (real bug fix: budget spending should be negative for expenses)

### 3k. `backend/src/notifications/bill-reminder.service.spec.ts`

**Resolution:** Keep our branch's version as the base. Accept only non-auth bug fixes from main. Main's changes mostly involve email notification tests which are irrelevant (profiles have no email).

### 3l. `.env.example`

**Resolution:** Keep our branch's version (has `COOKIE_SECRET`, no `JWT_SECRET`). Then add from main:
```
DISABLE_HTTPS_HEADERS=false
```

Do NOT add: `JWT_SECRET`, `JWT_EXPIRATION`, `LOCAL_AUTH_ENABLED`, `REGISTRATION_ENABLED`, `FORCE_2FA`, `REMEMBER_ME_DAYS`, `OIDC_*`, `SMTP_*`, `EMAIL_FROM`.

### 3m. `.claude/settings.local.json`

**Resolution:** Take whichever version is more up-to-date, or merge manually. This is a local dev config file.

---

## Phase 4: Manual content conflict resolution (frontend)

### 4a. `frontend/src/app/page.tsx`

**Resolution:** Keep our branch's version entirely:
```typescript
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/profiles');
}
```

### 4b. `frontend/src/app/settings/page.tsx`

**Resolution:** Keep our branch's version as the base. Add only `BackupRestoreSection`:

Add import:
```typescript
import { BackupRestoreSection } from '@/components/settings/BackupRestoreSection';
```

Add the component in the JSX, between the AI Settings link and `DangerZoneSection`:
```tsx
{!isDemoMode && <BackupRestoreSection />}
```

Do NOT add: `NotificationsSection`, `SecuritySection`, `ApiAccessSection`, or any `smtpConfigured`/`force2fa`/`authApi.getAuthMethods()` logic.

### 4c. `frontend/src/components/settings/DangerZoneSection.tsx` and `.test.tsx`

**Resolution:** Keep our branch's version entirely for both files. Main's version adds "Delete Data" and "Delete Account" flows with password confirmation and OIDC re-auth, which don't apply without passwords.

### 4d. `frontend/src/components/auth/ProtectedRoute.test.tsx`

**Resolution:** Keep our branch's version entirely. It tests `profileStore.isSelected` and redirect to `/profiles`.

### 4e. `frontend/src/lib/user-settings.ts` and `.test.ts`

**Resolution:** Keep our branch's version entirely for both files. Main adds `changePassword`, `deleteAccount`, `deleteData`, `getSmtpStatus`, `sendTestEmail` -- all auth-related.

### 4f. `frontend/src/types/auth.ts`

**Resolution:** Keep our branch's version as the base. Add only `favouriteReportIds` to support the favourite reports feature:

In `UserPreferences` interface, add:
```typescript
favouriteReportIds: string[];
```

In `UpdatePreferencesData` interface, add:
```typescript
favouriteReportIds?: string[];
```

### 4g. `frontend/src/proxy.ts`

**Resolution:** Keep our branch's version as the base. Add only the `DISABLE_HTTPS_HEADERS` conditional.

In the `nextWithCsp` function, after `requestHeaders.set('x-nonce', nonce);` add:
```typescript
if (process.env.DISABLE_HTTPS_HEADERS !== 'true') {
  requestHeaders.set('x-https-headers-active', 'true');
}
```

---

## Phase 5: Manual content conflict resolution (infrastructure)

### 5a. `docker-compose.dev.yml`

**Resolution:** Keep our branch's version as the base. Add from main:

In `backend.environment`, add:
```yaml
DISABLE_HTTPS_HEADERS: ${DISABLE_HTTPS_HEADERS:-false}
```

In `frontend.environment`, add:
```yaml
DISABLE_HTTPS_HEADERS: ${DISABLE_HTTPS_HEADERS:-false}
```

Do NOT add: `JWT_SECRET`, `JWT_EXPIRATION`, `LOCAL_AUTH_ENABLED`, `REGISTRATION_ENABLED`, `FORCE_2FA`, `REMEMBER_ME_DAYS`, `OIDC_*`, `SMTP_*`, `EMAIL_FROM`.

Note: Main binds the frontend port to `127.0.0.1:${FRONTEND_PORT:-3001}:3000` (localhost only). Our branch uses `${FRONTEND_PORT:-3001}:3000` (all interfaces). **Keep our version** (all interfaces) since we need LAN/Tailscale access as documented in the cheatsheet.

### 5b. `docker-compose.prod.yml`

**Resolution:** Same approach as dev. Keep our branch's version, add `DISABLE_HTTPS_HEADERS` to both backend and frontend environments.

### 5c. `database/schema.sql`

**Resolution:** This is the most involved file. Start from our branch's version (simplified `users` table without `email`, `password_hash`, `role`, etc.), then add all new feature tables/columns from main's migrations:

Add to `user_preferences` table definition:
- `favourite_report_ids TEXT[] DEFAULT '{}'`

Add to `accounts` table definition (from migrations 027/028):
- `statement_due_day INTEGER` (credit card due day)
- `statement_settlement_day INTEGER` (credit card settlement day)
- Add constraint: `CHECK (statement_due_day IS NULL OR (statement_due_day >= 1 AND statement_due_day <= 31))`
- Add constraint: `CHECK (statement_settlement_day IS NULL OR (statement_settlement_day >= 1 AND statement_settlement_day <= 31))`

Change `security_prices.close_price` precision (from migration 029):
- From `DECIMAL(20,4)` to `DECIMAL(20,6)`
- Also change `open_price`, `high_price`, `low_price` to `DECIMAL(20,6)`

Add new table `import_column_mappings` (from migration 030):
```sql
CREATE TABLE IF NOT EXISTS import_column_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  mappings JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);
```

Add new table `payee_aliases` (from migration 031):
```sql
CREATE TABLE IF NOT EXISTS payee_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payee_id UUID NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
  pattern VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, pattern)
);
```

Add new tables for tags (from migration 032):
```sql
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS transaction_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS transaction_split_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  split_id UUID NOT NULL REFERENCES transaction_splits(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(split_id, tag_id)
);
```

Add to `scheduled_transactions` table (from migration 033):
- `tag_ids TEXT[] DEFAULT '{}'`

Do NOT add: `trusted_devices.user_agent_hash`, `refresh_tokens.remember_me` -- those tables were dropped by our migration 025.

**Tip:** Check `git show origin/main:database/schema.sql` to see the full main schema and compare with ours to ensure nothing is missed.

---

## Phase 6: Accept remaining auto-merged files from main

After resolving all conflicts above, many files from main will have been auto-merged successfully by git. These are files that main changed but our branch didn't touch (or touched in non-overlapping areas). They include:

- All report components (spending, income, tax, etc.)
- Import wizard hooks and components
- Payee improvements (last used, sorting)
- Currency/securities page improvements
- Transaction filter improvements
- Various bug fixes

These should need no manual intervention. Verify with:
```bash
git diff --check  # Check for remaining conflict markers
```

---

## Phase 7: Restore stashed changes and finalize

```bash
# Restore the custom default-categories
git stash pop

# Stage everything
git add -A

# Verify no conflict markers remain
grep -rn "<<<<<<\|======\|>>>>>>" backend/src/ frontend/src/ database/ --include="*.ts" --include="*.tsx" --include="*.sql"

# Commit the merge
git commit -m "Merge origin/main: add tags, backup/restore, CSV/OFX import, payee aliases, PDF export, and bug fixes"
```

---

## Phase 8: Validation

### 8a. Build verification (catches import/type errors)

```bash
docker compose -f docker-compose.prod.yml build
```

### 8b. Key things to verify compile cleanly

- `app.module.ts` imports `TagsModule` and `BackupModule` but NOT `AuthModule` or `AdminModule`
- `tags.controller.ts` and `backup.controller.ts` use `SessionGuard` not `AuthGuard("jwt")`
- `import.controller.ts` uses `SessionGuard` not `AuthGuard("jwt")`
- `users.module.ts` does not import anything from `auth/`
- `api.ts` does not import `useAuthStore` or `js-cookie`
- `settings/page.tsx` does not reference `smtpConfigured`, `force2fa`, or `authApi.getAuthMethods()`
- `types/auth.ts` has `favouriteReportIds` but NOT `notificationEmail`/`twoFactorEnabled`

### 8c. Run tests

```bash
# Backend unit tests
docker exec monize-backend npm run test:unit

# Frontend tests
docker exec monize-frontend npm run test
```

### 8d. Manual smoke test

1. Navigate to `/` -- should redirect to `/profiles`
2. Select a profile -- session cookie `profile_session` is set
3. Navigate to `/settings` -- `BackupRestoreSection` is visible
4. Navigate to `/tags` -- tags page is accessible
5. Test CSV import wizard
6. Confirm `/login` returns 404 (route is gone)

---

## Quick reference: Conflict resolution cheatsheet

| File/group | Strategy |
|---|---|
| `backend/src/auth/` (entire dir) | Delete -- ours wins |
| `backend/src/admin/` (entire dir) | Delete -- ours wins |
| `backend/src/ai/{auth-email,token,two-factor}.*` | Delete -- misplaced auth files |
| `backend/src/common/guards/csrf.*` | Delete -- ours wins |
| `backend/src/common/interceptors/csrf-refresh.*` | Delete -- ours wins |
| `backend/src/tags/`, `backup/` | Accept from main, fix guard to SessionGuard |
| `backend/src/import/` new parsers | Accept from main |
| `backend/src/import/import.controller.ts` | Take main's, fix guard to SessionGuard |
| `backend/src/app.module.ts` | Ours + add TagsModule, BackupModule |
| `backend/src/main.ts` | Main's + restore COOKIE_SECRET, remove auth CORS headers |
| `backend/src/users/users.module.ts` | Ours entirely |
| `backend/src/users/users.service.ts` | Ours + add favouriteReportIds |
| `backend/src/users/users.controller.ts` | Ours entirely |
| `backend/src/users/dto/update-preferences.dto.ts` | Ours + add favouriteReportIds field |
| `backend/src/users/entities/user-preference.entity.ts` | Ours + add favouriteReportIds column |
| `backend/src/users/*.spec.ts` | Ours, accept only non-auth bug fixes |
| `backend/src/budgets/budget-alert.service.spec.ts` | Ours + accept sign fix (-550, -600) |
| `database/schema.sql` | Ours base + new feature tables from main |
| `database/migrations/025` | Ours (simplify-to-profiles); main's 025 becomes 035 |
| `database/migrations/026,034` | Accept, add IF EXISTS guards for dropped auth tables |
| `docker-compose.dev.yml` | Ours + add DISABLE_HTTPS_HEADERS |
| `docker-compose.prod.yml` | Ours + add DISABLE_HTTPS_HEADERS |
| `.env.example` | Ours + add DISABLE_HTTPS_HEADERS |
| `frontend/src/app/page.tsx` | Ours entirely (redirect to /profiles) |
| `frontend/src/app/login/`, `register/`, etc. | Delete -- ours wins |
| `frontend/src/app/settings/page.tsx` | Ours + add BackupRestoreSection |
| `frontend/src/components/settings/DangerZoneSection.*` | Ours entirely |
| `frontend/src/components/settings/SecuritySection.*` | Delete -- ours wins |
| `frontend/src/components/settings/NotificationsSection.*` | Delete -- ours wins |
| `frontend/src/components/auth/ProtectedRoute.*` | Ours entirely |
| `frontend/src/lib/api.ts` | Ours entirely |
| `frontend/src/lib/auth.ts` | Ours entirely |
| `frontend/src/lib/user-settings.*` | Ours entirely |
| `frontend/src/types/auth.ts` | Ours + add favouriteReportIds |
| `frontend/src/proxy.ts` | Ours + add DISABLE_HTTPS_HEADERS block |
| `frontend/src/store/authStore.*` | Delete -- ours wins |
| `frontend/src/test/mocks/stores.ts` | Ours entirely |
| `.claude/settings.local.json` | Merge manually (local dev config) |
