# Backend Directory

NestJS API server. All commands run from this directory.

## Commands

```bash
npm run start:dev          # Dev server with HMR
npm run start:scheduler    # Cron job process (separate from main server)
npm run build              # Production build
npm run lint               # ESLint --fix
npm run test               # All tests (unit + E2E)
npm run test:unit          # Unit tests only (src/**/*.spec.ts)
npm run test:cov           # Coverage report (80% minimum all metrics)
npm run test:e2e           # E2E tests (test/**/*.spec.ts, 30s timeout, sequential)
```

## Feature Modules

21 modules in `src/`, each following the standard structure:

| Module | Description |
|--------|-------------|
| accounts | Financial accounts (chequing, savings, credit, loan, mortgage, investment, asset) |
| admin | User management (roles, status, password reset) |
| ai | AI providers, query engine, insights, usage tracking |
| auth | JWT, OIDC, 2FA/TOTP, PATs, refresh tokens, local strategy |
| budgets | Budget CRUD, period management, alerts |
| built-in-reports | Pre-built reports (spending, income, trends, anomalies, tax) |
| categories | Transaction categories (hierarchical tree via `parent_id`) |
| common | Shared guards, filters, decorators, pipes, validators, utilities |
| currencies | Currency management, exchange rate fetching |
| database | DB init, migrations, seeding, demo reset |
| health | Health check (no auth) |
| import | QIF/OFX file import and transaction processing |
| mcp | Model Context Protocol server integration |
| net-worth | Net worth calculations and snapshots |
| notifications | Email service, bill reminders, mortgage reminders |
| payees | Payee management with default categories |
| reports | Custom report builder |
| scheduled-transactions | Recurring transactions, loan transactions |
| securities | Stocks/ETFs, holdings, investment transactions, price updates |
| transactions | Core transaction CRUD, splits, transfers, reconciliation, analytics |
| users | User profiles, preferences, trusted devices |

## Module File Naming

```
{feature}/
  {feature}.module.ts
  {feature}.controller.ts
  {feature}.service.ts
  {feature}.controller.spec.ts
  {feature}.service.spec.ts
  entities/{entity}.entity.ts
  dto/create-{entity}.dto.ts
  dto/update-{entity}.dto.ts
```

## Configuration

- **Path alias:** `@/*` maps to `src/*` (tsconfig + Jest moduleNameMapper)
- **ESLint:** Flat config (`eslint.config.mjs`) with typescript-eslint + prettier
- **Jest:** 80% coverage threshold (branches, functions, lines, statements). Excludes `main.ts`, modules, entities, DTOs, seed scripts, and migrations from coverage.
- **TypeScript:** ES2021 target, CommonJS modules, `strictNullChecks: true`, `noImplicitAny: false`

## Global Providers (app.module.ts)

Registered globally via `APP_FILTER`, `APP_GUARD`, `APP_INTERCEPTOR`:

| Provider | Purpose |
|----------|---------|
| `GlobalExceptionFilter` | Catches all exceptions; handles HttpException and TypeORM QueryFailedError |
| `ThrottlerGuard` | Rate limiting (100 requests/minute) |
| `CsrfGuard` | CSRF double-submit cookie validation |
| `MustChangePasswordGuard` | Blocks access until password change (admin-reset users) |
| `DemoModeGuard` | Restricts write operations in demo mode |
| `CsrfRefreshInterceptor` | Refreshes CSRF token cookie on responses |
| `ClassSerializerInterceptor` | Applies `@Exclude()` / `@Expose()` from class-transformer |

Also configured: `ConfigModule` (global), `TypeOrmModule` (async, PostgreSQL), `ThrottlerModule`, `ScheduleModule`.

## main.ts Setup

- **API prefix:** `api/v1`
- **Body limit:** 10mb (for large QIF file imports)
- **Swagger:** Enabled at `/api/docs` in non-production only
- **DATE column parser:** `pg.types.setTypeParser(1082, val => val)` -- returns DATE columns as strings to prevent timezone-related date shifting
- **Validation pipe:** Global with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **Security:** Helmet (CSP, HSTS, frame-deny), CORS (credentials, configurable origins)
- **Cookie parser:** Required for OIDC state/nonce and auth tokens
- **Trust proxy:** Level 1 (Docker/nginx real client IP)

## Common Utilities (`src/common/`)

```
common/
  date-utils.ts              # formatDateYMD, todayYMD, getMonthEndYMD, isTransactionInFuture
  query-param-utils.ts       # parseIds, parseUuids, parseCategoryIds, validateDateParam, UUID_REGEX
  csrf.util.ts               # CSRF token utilities
  category-tree.util.ts      # Category hierarchy utilities
  demo-mode.module.ts        # DemoModeService (global)
  decorators/
    sanitize-html.decorator  # @SanitizeHtml() -- strips < and > to prevent stored XSS
    skip-csrf.decorator      # @SkipCsrf() -- skip CSRF for non-cookie auth (PAT bearer)
    demo-restricted.decorator # @DemoRestricted() -- block operation in demo mode
  filters/
    http-exception.filter    # GlobalExceptionFilter
  guards/
    csrf.guard               # CSRF double-submit cookie validation
    demo-mode.guard           # Demo mode write restriction
  interceptors/
    csrf-refresh.interceptor # Refreshes CSRF cookie on response
  pipes/
    parse-currency-code.pipe # Validates currency codes
    parse-symbol.pipe        # Validates security symbols
  validators/
    is-future-date.validator # Custom class-validator for future dates
```

## Entity Conventions

**DATE columns** use string transformers to avoid timezone issues:
```typescript
@Column({
  type: 'date',
  name: 'transaction_date',
  transformer: {
    from: (value: string | Date): string => {
      if (!value) return value as string;
      if (typeof value === 'string') return value;
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    },
    to: (value: string | Date): string | Date => value,
  },
})
transactionDate: string;
```

**Decimal columns** use `numericTransformer` to convert PostgreSQL string representation to JavaScript number:
```typescript
const numericTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => value === null ? null : Number(value),
};
```

**Timestamp columns** are always present:
```typescript
@CreateDateColumn({ name: 'created_at' })
createdAt: Date;

@UpdateDateColumn({ name: 'updated_at' })
updatedAt: Date;
```

## Testing Conventions

**Mock repositories** use `Record<string, jest.Mock>`:
```typescript
const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};
```

**Test module setup** uses `Test.createTestingModule` with providers injecting mocks via `getRepositoryToken()`.

**E2E tests** live in `test/` with helpers:
- `test/helpers/auth-helper.ts` -- auth test utilities
- `test/helpers/test-database.ts` -- database setup
- `test/helpers/test-factories.ts` -- test data factories

## Cron Jobs

Cron jobs use the `@Cron()` decorator from `@nestjs/schedule`. They run in a separate process (`npm run start:scheduler`).

| Service | Schedule | Purpose |
|---------|----------|---------|
| `demo-reset.service` | Daily 4 AM, every 3 hours | Demo database reset |
| `ai-usage.service` | Daily 4 AM | AI usage cleanup |
| `ai-insights.service` | Daily 6 AM | Generate AI insights |
| `auth.service` | Daily 3 AM | Expired token cleanup |
| `scheduled-transactions.service` | Every 5 min past hour | Post due recurring transactions |
| `exchange-rate.service` | 5 PM ET weekdays | Fetch exchange rates |
| `accounts.service` | Midnight daily | Account maintenance |
| `mortgage-reminder.service` | Daily 8 AM | Mortgage payment reminders |
| `bill-reminder.service` | Daily 8 AM | Bill payment reminders |
| `budget-period-cron.service` | 1st of month midnight | Create new budget periods |
| `budget-alert.service` | Daily 7 AM, Mon 7 AM, Daily 3 AM | Budget threshold alerts |
| `security-price.service` | 5 PM ET weekdays | Fetch security prices |
