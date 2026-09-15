/**
 * Dot-path access into the content document, e.g. "sections.3.items.0.title".
 *
 * Paths are how every editable thing on the page identifies itself, so this
 * lives on its own rather than inside the store: components that only need to
 * *read* a value shouldn't have to import the whole provider module.
 */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** Immutably set a nested value, cloning each level along the way. */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone: unknown = Array.isArray(obj) ? [...obj] : { ...(obj as object) };
  let cursor = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    cursor[key] = Array.isArray(next) ? [...next] : { ...(next as object) };
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return clone as T;
}
