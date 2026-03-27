# Plan: Undo/Redo System for Monize

## Context

Users want the ability to undo and redo changes made in Monize. Currently, all mutations are permanent -- there is no audit trail, no change history, and no way to reverse an action except by manually re-entering data. The existing codebase has zero undo infrastructure (no history tables, no event system, no keyboard shortcuts). The one exception is a 5-second undo window for budget alert dismissals in the frontend.

This plan introduces a **server-side action history** with a **command pattern** approach -- storing the reverse operation for each user action, enabling both undo and redo.

## Approach: Server-Side Action History (Command Pattern)

Store a history of user actions in a database table. Each record captures enough information to reverse (undo) or re-apply (redo) the action. The backend service layer records actions after successful mutations. The frontend provides Ctrl+Z/Cmd+Z shortcuts and toast-based undo prompts.

### Why server-side over frontend-only?
- Survives page refresh and browser close
- Works across devices (undo on phone what you did on desktop)
- Single source of truth -- no frontend/backend state divergence
- Balances and side effects (transfers, holdings) are managed server-side anyway

### Why command pattern over full snapshots?
- Snapshots of entire entities are wasteful for small field changes
- Command pattern stores just `beforeData` and `afterData` (the changed fields)
- For creates: `beforeData = null`, `afterData = { full entity snapshot }`
- For deletes: `beforeData = { full entity snapshot }`, `afterData = null`
- For updates: `beforeData = { old field values }`, `afterData = { new field values }`

---

## Phase 1: Database Schema

### New table: `action_history`

```sql
CREATE TABLE IF NOT EXISTS action_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What was done
    entity_type VARCHAR(50) NOT NULL,        -- 'transaction', 'account', 'category', etc.
    entity_id UUID NOT NULL,                 -- Primary entity ID
    action VARCHAR(20) NOT NULL,             -- 'create', 'update', 'delete', 'bulk_update', 'bulk_delete'

    -- Reverse data (JSONB for flexibility)
    before_data JSONB,                       -- State before action (null for creates)
    after_data JSONB,                        -- State after action (null for deletes)

    -- For compound operations (transfers, splits, investments)
    related_entities JSONB,                  -- [{entityType, entityId, beforeData, afterData}]

    -- Undo/redo state
    is_undone BOOLEAN NOT NULL DEFAULT false, -- true after undo (available for redo)

    -- Metadata
    description VARCHAR(255) NOT NULL,       -- Human-readable: "Created transaction: Grocery Store -$45.00"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Index for fast per-user queries
    CONSTRAINT action_history_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_action_history_user_created
    ON action_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_history_user_undone
    ON action_history(user_id, is_undone, created_at DESC);
```

### Files to create/modify:
- **Create:** `database/migrations/039_action_history.sql`
- **Modify:** `database/schema.sql` -- add the table definition

---

## Phase 2: Backend Action History Module

### New module: `backend/src/action-history/`

```
backend/src/action-history/
  action-history.module.ts
  action-history.service.ts
  action-history.controller.ts
  entities/action-history.entity.ts
  dto/action-history-response.dto.ts
  action-history.service.spec.ts
  action-history.controller.spec.ts
```

### Entity: `action-history.entity.ts`

TypeORM entity mapping to `action_history` table. Fields: id, userId, entityType, entityId, action, beforeData (JSONB), afterData (JSONB), relatedEntities (JSONB), isUndone, description, createdAt.

### Service: `action-history.service.ts`

Core methods:

```typescript
// Record an action (called by other services after successful mutations)
async record(userId: string, params: {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  relatedEntities?: RelatedEntity[];
  description: string;
}): Promise<ActionHistory>

// Get undo/redo stack for user
async getHistory(userId: string, limit?: number): Promise<ActionHistory[]>

// Undo the most recent non-undone action
async undo(userId: string): Promise<{ action: ActionHistory; result: any }>

// Redo the most recent undone action
async redo(userId: string): Promise<{ action: ActionHistory; result: any }>

// Cleanup old history (cron, keep last 100 per user or 30 days)
async cleanup(): Promise<void>
```

**Undo logic** (simplified):
1. Find most recent action where `is_undone = false` for user
2. Based on `action` type:
   - **create** -> delete the entity (+ related entities)
   - **update** -> apply `beforeData` fields to the entity
   - **delete** -> re-create the entity from `beforeData` (+ related entities)
3. Recalculate affected account balances
4. Mark action as `is_undone = true`

**Redo logic**:
1. Find most recent action where `is_undone = true` for user
2. Based on `action` type:
   - **create** -> re-create from `afterData`
   - **update** -> apply `afterData` fields
   - **delete** -> delete the entity again
3. Recalculate affected account balances
4. Mark action as `is_undone = false`

**When a new action is recorded, clear the redo stack** (delete all `is_undone = true` for user that are newer than the last non-undone action). This matches standard undo/redo behavior.

### Controller: `action-history.controller.ts`

```
POST   /action-history/undo    -- Undo most recent action
POST   /action-history/redo    -- Redo most recent undone action
GET    /action-history          -- List recent actions (for UI history panel)
```

All endpoints use `@UseGuards(AuthGuard('jwt'))` and derive userId from `req.user.id`.

---

## Phase 3: Integrate Recording into Existing Services

Each service records actions after successful mutations. Recording is **best-effort** -- if recording fails, the original mutation still succeeds (action history is non-critical).

### Entity types and what to capture:

| Entity Type | Actions | beforeData / afterData | relatedEntities |
|---|---|---|---|
| `transaction` | create, update, delete | Full transaction + splits + tags | Linked transfer transaction (if transfer) |
| `transfer` | create, delete | Both transactions | Split transfer linked transactions |
| `investment_transaction` | create, update, delete | InvestmentTransaction + linked Transaction | Holding snapshot before/after |
| `account` | create, update, delete | Full account fields | Linked account (investment pairs) |
| `category` | create, update, delete | Category fields | -- |
| `payee` | create, update, delete | Payee fields | -- |
| `tag` | create, update, delete | Tag fields | -- |
| `budget` | create, update, delete | Budget + categories | -- |
| `scheduled_transaction` | create, update, delete | Template + splits + overrides | -- |
| `bulk_transaction` | bulk_update, bulk_delete | Array of transaction snapshots | Per-transaction linked transfers |

### Files to modify (add `record()` calls):

- `backend/src/transactions/transactions.service.ts` -- create, update, delete
- `backend/src/transactions/transaction-transfer.service.ts` -- createTransfer
- `backend/src/transactions/transaction-bulk-update.service.ts` -- bulkUpdate, bulkDelete
- `backend/src/securities/investment-transactions.service.ts` -- create, update, delete
- `backend/src/accounts/accounts.service.ts` -- create, update, delete
- `backend/src/categories/categories.service.ts` -- create, update, delete
- `backend/src/payees/payees.service.ts` -- create, update, delete
- `backend/src/tags/tags.service.ts` -- create, update, delete
- `backend/src/budgets/budgets.service.ts` -- create, update, delete
- `backend/src/scheduled-transactions/scheduled-transactions.service.ts` -- create, update, delete

### Recording pattern (example for transactions.service.ts create):

```typescript
// After successful commit in create():
const fullTransaction = await this.findOne(userId, savedTransaction.id);
await this.actionHistoryService.record(userId, {
  entityType: 'transaction',
  entityId: savedTransaction.id,
  action: 'create',
  afterData: this.snapshotTransaction(fullTransaction),
  description: `Created transaction: ${fullTransaction.payeeName || 'Unknown'} ${fullTransaction.amount}`,
});
```

Recording happens **after** the QueryRunner commits, outside the transaction. This ensures we only record successful mutations.

---

## Phase 4: Undo/Redo Execution Logic

The `ActionHistoryService.undo()` and `redo()` methods delegate to entity-specific reverse handlers. Each handler knows how to reverse its entity type's operations.

### Reverse handlers (private methods on ActionHistoryService):

```typescript
private async undoTransactionCreate(action: ActionHistory, queryRunner: QueryRunner): Promise<void>
private async undoTransactionUpdate(action: ActionHistory, queryRunner: QueryRunner): Promise<void>
private async undoTransactionDelete(action: ActionHistory, queryRunner: QueryRunner): Promise<void>
private async undoTransferCreate(action: ActionHistory, queryRunner: QueryRunner): Promise<void>
private async undoAccountCreate(action: ActionHistory, queryRunner: QueryRunner): Promise<void>
// ... etc for each entity type
```

### Key complexity: Transfers and Investments

**Undo transfer create:**
1. Load both linked transaction IDs from `relatedEntities`
2. Delete both transactions within same QueryRunner
3. Recalculate both account balances

**Undo investment transaction create:**
1. Delete the InvestmentTransaction
2. Delete the linked cash Transaction (if any)
3. Rebuild holdings for the account (`holdingsService.rebuildFromTransactions()`)
4. Recalculate cash account balance

**Undo bulk delete:**
1. `beforeData` contains array of full transaction snapshots
2. Re-create each transaction with its original ID (using `queryRunner.manager.save()` with explicit ID)
3. Re-create splits, tags, linked transfers from `relatedEntities`
4. Recalculate all affected account balances

### Edge cases and guards:

- **Account closed since action**: Temporarily reopen, perform undo, re-close if it was the undo target
- **Entity already modified since action**: Check `updatedAt` timestamp; if entity was modified after the action, warn user (return conflict status) rather than silently overwriting
- **Referenced entity deleted** (e.g., undo transaction create but category was deleted): Allow undo but set categoryId to null
- **Reconciled transactions**: Block undo of actions that would modify reconciled transactions (return 409 Conflict)

---

## Phase 5: Frontend Integration

### New API client: `frontend/src/lib/actionHistoryApi.ts`

```typescript
export const actionHistoryApi = {
  undo: () => api.post('/action-history/undo'),
  redo: () => api.post('/action-history/redo'),
  getHistory: (limit?: number) => api.get('/action-history', { params: { limit } }),
};
```

### Keyboard shortcuts: `frontend/src/hooks/useUndoRedo.ts`

Global hook mounted in the app layout that listens for:
- `Ctrl+Z` / `Cmd+Z` -> call `actionHistoryApi.undo()`
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` -> call `actionHistoryApi.redo()`

On success: show toast with action description ("Undone: Created transaction...") and refresh current page data.
On conflict: show toast with warning ("Cannot undo: transaction has been modified").
On empty stack: show toast "Nothing to undo".

### Toast integration:

After every successful mutation (create/update/delete), show a toast with an "Undo" button:

```
"Transaction created" [Undo]
```

Clicking "Undo" calls `actionHistoryApi.undo()`. This leverages the existing toast system.

### Mount point: `frontend/src/app/layout.tsx`

Add `useUndoRedo()` hook to the root layout so keyboard shortcuts work globally.

### Files to create:
- `frontend/src/lib/actionHistoryApi.ts`
- `frontend/src/hooks/useUndoRedo.ts`

### Files to modify:
- `frontend/src/app/layout.tsx` -- mount the hook
- Various page components -- add "Undo" button to success toasts (optional enhancement, keyboard shortcut is primary UX)

---

## Phase 6: Cleanup & Limits

- **Cron job** in `ActionHistoryService`: `@Cron('0 3 * * *')` -- daily at 3 AM UTC
  - Delete records older than 30 days
  - Keep max 100 records per user (delete oldest beyond limit)
- **Size limit on JSONB**: Cap `before_data` and `after_data` at reasonable size. For bulk operations with 100+ transactions, store summary only (IDs + key fields) rather than full snapshots.

---

## Implementation Order

1. Database migration + schema.sql update
2. ActionHistory entity + module + service (recording only)
3. Integrate recording into TransactionsService (most common entity)
4. Implement undo/redo execution for transactions
5. Add controller endpoints
6. Frontend: API client + keyboard shortcut hook + toast integration
7. Extend recording to remaining entities (accounts, categories, etc.)
8. Extend undo/redo handlers for remaining entities
9. Add cleanup cron
10. Tests

---

## Verification

1. **Unit tests**: ActionHistoryService -- record, undo, redo for each entity type
2. **Integration test**: Create transaction -> verify history record -> undo -> verify transaction deleted and balance restored -> redo -> verify transaction recreated
3. **Transfer test**: Create transfer -> undo -> verify both transactions deleted and both balances correct
4. **Bulk test**: Bulk delete 5 transactions -> undo -> verify all 5 restored
5. **Edge case tests**: Undo after account closed, undo after category deleted, undo reconciled transaction (should fail)
6. **Frontend**: Ctrl+Z triggers undo API call, toast shows correct message, page data refreshes
7. **Cleanup**: Verify cron deletes old records, respects per-user limit

### Manual testing:
```bash
# Backend tests
cd backend && npm run test -- --testPathPattern=action-history

# Frontend tests
cd frontend && npm run test -- --testPathPattern=useUndoRedo

# E2E (if added)
cd e2e && npm run test -- --grep "undo"
```

---

## Files Summary

### New files:
- `database/migrations/039_action_history.sql`
- `backend/src/action-history/action-history.module.ts`
- `backend/src/action-history/action-history.service.ts`
- `backend/src/action-history/action-history.controller.ts`
- `backend/src/action-history/entities/action-history.entity.ts`
- `backend/src/action-history/dto/action-history-response.dto.ts`
- `backend/src/action-history/action-history.service.spec.ts`
- `backend/src/action-history/action-history.controller.spec.ts`
- `frontend/src/lib/actionHistoryApi.ts`
- `frontend/src/hooks/useUndoRedo.ts`

### Modified files:
- `database/schema.sql` -- add action_history table
- `backend/src/app.module.ts` -- register ActionHistoryModule
- `backend/src/transactions/transactions.service.ts` -- add recording calls
- `backend/src/transactions/transaction-transfer.service.ts` -- add recording calls
- `backend/src/transactions/transaction-bulk-update.service.ts` -- add recording calls
- `backend/src/securities/investment-transactions.service.ts` -- add recording calls
- `backend/src/accounts/accounts.service.ts` -- add recording calls
- `backend/src/categories/categories.service.ts` -- add recording calls
- `backend/src/payees/payees.service.ts` -- add recording calls
- `backend/src/tags/tags.service.ts` -- add recording calls
- `backend/src/budgets/budgets.service.ts` -- add recording calls
- `backend/src/scheduled-transactions/scheduled-transactions.service.ts` -- add recording calls
- `frontend/src/app/layout.tsx` -- mount useUndoRedo hook
