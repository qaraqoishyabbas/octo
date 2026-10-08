# Web Code Conventions

The web app uses Nuxt components for presentation and Pinia stores for API operations.

## Stores

- Keep HTTP requests and upload transport in `app/stores`.
- Use domain stores rather than a single generic API store.
- Follow `dialogs.ts`: expose `list` or `current`, `loading`, `error`, named actions, and `$reset`.
- Keep separate request states for independent operations such as searching and saving.
- Lists own their pagination, deduplication, and search results.
- Invalidate pending results on reset and target changes. An old response must not replace a new screen's data or clear its loading state.
- For several simultaneous views of a domain, create independent scopes and dispose them when their component unmounts.
- Store `$reset` clears data and invalidates work without destroying scopes still used by mounted components.
- Authentication resets account-specific stores. Uploads and downloads also abort active requests.

## Components

- Components own form inputs, presentation, overlays, confirmations, and navigation.
- Call store actions instead of `$http`, `$fetch`, `useFetch`, or `XMLHttpRequest`.
- Use `storeToRefs` when destructuring Pinia state; use `toRefs` for a scope's reactive state.
- Compose loading, error, and empty states as separate domain components, following `DialogsListLoading` and `DialogsListError`.
- Error components emit `retry`; the parent binds the appropriate store action.
- Extract substantial reusable sections, such as login forms and upload previews. Keep individual controls with their owning section.
- Composables may coordinate browser-only behavior such as scrolling, clipboard access, and saving Blobs, but delegate API requests to stores.
- Cancel timers, listeners, and temporary browser resources during unmount.

## Verification

Run `node --test test/*.ts` and `npm run build` from this directory.
`web-request-boundaries.test.ts` checks HTTP ownership and compiles the Vue components and pages.
