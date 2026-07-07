/**
 * Pure, environment-agnostic helpers shared by both client and server code.
 *
 * Kept separate from `lib/utils.ts` so that server-side modules (route
 * handlers, the shared-library backend) can import a hashing primitive
 * without pulling in client-only UI dependencies such as `clsx` or
 * `tailwind-merge`.
 */

/**
 * Stable, non-cryptographic content hash used as a book's unique id.
 *
 * The same bytes always produce the same `bk-<hex>` id, which lets the shared
 * library deduplicate uploads and keeps a user's saved reading position
 * (keyed by id) stable across sessions.
 */
export function hashBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let h1 = 0xdeadbeef ^ view.length;
  let h2 = 0x41c6ce57 ^ view.length;
  for (let i = 0; i < view.length; i++) {
    const c = view[i];
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return `bk-${hash}`;
}

/** Short, collision-resistant-enough id for client-side records (translations, quotes). */
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
