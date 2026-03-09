# Frontend Directory

Next.js App Router application. All commands run from this directory.

## Commands

```bash
npm run dev                # Dev server (port 3000)
npm run build              # Production build (standalone output for Docker)
npm run lint               # ESLint
npm run type-check         # tsc --noEmit
npm run test               # Vitest (single run)
npm run test:watch         # Vitest (watch mode)
npm run test:cov           # Coverage report (65% lines minimum)
```

## Directory Structure

```
src/
  app/             # Next.js App Router pages and layouts (26 routes)
  components/      # Feature-organized React components (21 feature directories + ui/)
  contexts/        # React context providers (ThemeContext)
  hooks/           # Custom React hooks
  lib/             # API clients (axios), utilities, helpers
  store/           # Zustand stores (profileStore, preferencesStore, demoStore)
  types/           # Shared TypeScript interfaces (13 type files)
  test/            # Test utilities (custom render, setup, mocks)
  proxy.ts         # API proxy, CSP nonces, auth redirects, security headers
```

## Configuration

- **Path alias:** `@/*` maps to `src/*` (tsconfig + Vitest resolve alias)
- **TypeScript:** ES2017 target, strict mode, bundler module resolution, React JSX
- **ESLint:** Flat config (`eslint.config.mjs`) extending eslint-config-next
- **Vitest:** jsdom environment, 30s timeout, V8 coverage provider
- **Coverage thresholds:** 65% lines/statements, 60% functions, 55% branches
- **Tailwind CSS v4:** Via `@tailwindcss/postcss` in `postcss.config.js`, `@import "tailwindcss"` in `globals.css`
- **Next.js:** Standalone output (Docker), strict mode, security headers in `next.config.js`

## API Layer (`src/lib/`)

**Central client** (`api.ts`): Axios instance with `baseURL: /api/v1`, `withCredentials: true`, 10s timeout.

**Error handling:**
- **Response (401):** Deselects profile and redirects to `/profiles`
- **Response (502):** Backend unavailable error

**Feature API modules** (one per feature, typed axios wrappers):
`accounts.ts`, `ai.ts`, `auth.ts` (profile API), `budgets.ts`, `built-in-reports.ts`, `categories.ts`, `custom-reports.ts`, `exchange-rates.ts`, `import.ts`, `investments.ts`, `net-worth.ts`, `payees.ts`, `scheduled-transactions.ts`, `transactions.ts`, `user-settings.ts`

**Utility modules:**
- `format.ts` -- currency, date, percentage formatting
- `utils.ts` -- general utilities
- `categoryUtils.ts` -- category grouping and sorting
- `account-utils.ts` -- account type helpers
- `chart-colours.ts` -- chart color palettes
- `forecast.ts` -- financial forecasting logic
- `time-periods.ts` -- date period helpers
- `apiCache.ts` -- simple in-memory cache
- `logger.ts` -- structured logger (debug, info, warn, error)
- `errors.ts` -- error type definitions
- `zodConfig.ts` -- Zod with `jitless: true` for CSP compliance
- `zod-helpers.ts` -- Zod schema helpers
- `constants.ts` -- shared constants

## Proxy (`src/proxy.ts`)

This is Next.js middleware (NOT the deprecated middleware pattern from this project's conventions). It handles:

- **API routing:** `/api/*` proxied to `INTERNAL_API_URL` (default `http://localhost:3001`)
- **CSP nonce:** Per-request nonce generated in `x-nonce` header, used by Next.js for inline scripts
- **Session redirects:** Requests without `profile_session` cookie redirect to `/profiles`
- **Security headers:** CSP with `strict-dynamic`, nonce-based script-src
- **Public paths:** `/profiles` (profile picker -- no session required)

## Component Patterns

**`'use client'` directive:** All interactive components (170+) use `'use client'`. Server components are the default for pages/layouts.

**Dynamic imports** for heavy components:
```typescript
const Chart = dynamic(() => import('./Chart'), { ssr: false });
```

**Feature component directories** (in `components/`):
accounts, ai, auth, bills, budgets, categories, currencies, dashboard, import, insights, investments, layout, payees, providers, reports, scheduled-transactions, securities, settings, transactions, ui

**`ProtectedRoute` wrapper** (`components/auth/ProtectedRoute.tsx`): Wraps pages requiring an active profile session. Checks `profileStore.isSelected` and redirects to `/profiles` if no profile is selected.

## UI Component Library (`components/ui/`)

22 shared components:

| Component | Purpose |
|-----------|---------|
| Button | Primary, secondary, outline, ghost, danger variants with size/loading |
| Modal | Dialog with browser history integration, focus trap, ESC/backdrop close |
| Input | Text input field |
| Select | Native select element |
| Combobox | Searchable dropdown |
| MultiSelect | Multi-choice dropdown |
| CurrencyInput | Number input formatted for currency amounts |
| NumericInput | Integer/decimal input with validation |
| DateRangeSelector | Calendar-based date range picker |
| Pagination | Table pagination controls |
| IconPicker | Icon selection from Heroicons |
| ColorPicker | Color picker with hex/RGB |
| LoadingSkeleton | Shimmer skeleton screens |
| LoadingSpinner | Rotating spinner animation |
| SummaryCard | Summary statistics card |
| ConfirmDialog | Confirmation modal |
| UnsavedChangesDialog | Save/discard/cancel changes prompt |
| FormActions | Form button group (Save/Cancel) |
| ChartViewToggle | Toggle between chart types |
| SortIcon | Ascending/descending sort indicator |
| ThemeToggle | Light/dark/system mode toggle |
| ErrorBoundary | React error boundary wrapper |

## Form Patterns

**`useFormModal<T>` hook** (`hooks/useFormModal.ts`): Manages modal state for create/edit flows.
- Browser history integration (back button closes modal)
- Unsaved changes detection with `UnsavedChangesDialog`
- Form submit exposed via ref (for Save from dialog)
- Returns `showForm`, `editingItem`, `openCreate()`, `openEdit(item)`, `close()`, `modalProps`, `unsavedChangesDialog`

**Supporting hooks:**
- `useFormSubmitRef` -- expose form submit function via ref
- `useFormDirtyNotify` -- track unsaved form changes, notify `useFormModal`

**Form libraries:** react-hook-form + Zod for validation.

## Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useFormModal` | Modal state for create/edit with unsaved changes dialog |
| `useFormSubmitRef` | Expose form submit via ref |
| `useFormDirtyNotify` | Track form dirty state |
| `useDateFormat` | Format dates based on user preferences |
| `useDateRange` | Date range selection state |
| `useNumberFormat` | Format numbers based on locale |
| `useExchangeRates` | Fetch and cache exchange rates |
| `useDemoMode` | Demo mode flag from store |
| `useLocalStorage` | localStorage with type safety |
| `useSwipeNavigation` | Mobile swipe gestures |
| `useTableDensity` | Compact/normal/comfortable table density |
| `useTransactionFilters` | Transaction filtering state |
| `useTransactionSelection` | Multi-select transactions |
| `useImportWizard` | CSV import wizard state |
| `useInvestmentData` | Investment holdings and transactions |
| `usePriceRefresh` | Refresh security prices |

## Testing Conventions

**Custom render** (`test/render.tsx`): Wraps components with `ThemeProvider`. Import `render` from `@/test/render` instead of `@testing-library/react`.

**Global mocks** (`test/setup.ts`):
- `next/navigation` -- useRouter, usePathname, useSearchParams
- `react-hot-toast` -- toast functions and Toaster component
- `localStorage` -- full mock (getItem, setItem, removeItem, clear)
- `window.scrollTo`, `window.matchMedia`

**Test file naming:** `Component.test.tsx` (co-located with component).

## Theme

`ThemeContext` provides `theme` (light/dark/system), `resolvedTheme`, and `setTheme()`.
- Persisted to localStorage
- Applies `dark` class to `<html>` element (Tailwind dark mode strategy)
- Listens for system preference changes via `matchMedia`
- Custom theme variables in `globals.css` `@theme` block (primary colors, semantic colors, font)
- Dark mode variant: `@variant dark (&:where(.dark, .dark *))`

## Security Notes

- **Zod:** Configured with `jitless: true` (`zodConfig.ts`) for CSP compliance -- no `new Function()`
- **Profile session:** Signed httpOnly cookie (`profile_session`), managed by backend
- **CSP:** Per-request nonce generated in proxy, `strict-dynamic` for script-src
- **ESLint:** `no-new-func: error` enforced to prevent CSP violations
