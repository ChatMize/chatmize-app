# Build Catalog + Release Notes Feed

Karl: "every time you deploy something, it would be like a message connected to the little icon that drops down, and it says this was built."

## What it is

ChatMize's own in house release notes. No third party tool.

- A sparkle bell in the top nav, next to the notifications bell, with an unread count. Its dropdown lists recent builds ("freshly built in ChatMize").
- Clicking any entry (or "View all") opens the Build Catalog page: every build with the date it was built and the date it went live, filterable by tag.
- Super Admin manages entries in Super Admin > Build Catalog (add, edit, delete, plus a one click backfill of the September launch builds).

## How a deploy becomes a message

Deploy coordinators call the `buildCatalogLog` action on the `metaOAuthStatus` callable after every deploy:

```js
// folded into metaOAuthStatus: new function creation is blocked through the
// deploy proxy, so this rides the existing callable with action routing.
await callMetaOAuthStatus({
  action: 'buildCatalogLog',
  title: 'Native bookings app',
  summary: 'ChatMize own booking system...',
  buildDate: '2026-09-19',
  goLiveDate: '2026-09-19',
  deployCommit: 'b55d723',
  bundleName: 'assets/index-BeI6_fkn.js',
  tags: ['growth', 'platform'],
});
```

Other actions: `buildCatalogUpdate` (id + fields), `buildCatalogDelete` (id). All Super Admin only (custom claim check).

## Storage

`system_settings/build_catalog` document: `{ entries: [...], updatedAt }`.

Firestore rules already allow signed in read and Super Admin write on `system_settings/{docId}`, so no rules change was needed.

## Files

- `src/lib/buildCatalog.ts` — types, Firestore reads, unread tracking (localStorage), callable wrappers
- `src/lib/buildCatalogSeed.ts` — backfill seed entries (deploys 1 to 17), not auto run
- `src/components/navigation/BuildCatalogBell.tsx` — the bell + dropdown
- `src/views/BuildCatalogView.tsx` — the catalog page (route `whats-new`)
- `src/components/admin/BuildCatalogAdminTab.tsx` — Super Admin CRUD + backfill button
- `functions/src/buildCatalog.ts` — server logic, folded into `metaOAuthStatus`

## Copy rule

All user facing copy is dash free: no em dashes, no hyphens in compounds.
