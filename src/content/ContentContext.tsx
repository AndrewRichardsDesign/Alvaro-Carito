import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Section, SectionType, SiteContent } from './types';
import { SECTION_TEMPLATES, newId } from './sectionTemplates';
import { getByPath, setByPath } from '@/lib/paths';
import defaultContent from './site-content.json';

/**
 * The content store.
 *
 * Adapted from the admin layer on the portfolio site: the whole document lives
 * in one JSON file, edits are held as a draft in localStorage so a refresh
 * never loses work, and saving commits the file straight back to GitHub with a
 * fine-grained token the editor pastes in. The wedding site adds sections as
 * first-class, addable/removable/reorderable data rather than fixed components.
 */

const CONTENT_PATH = 'src/content/site-content.json';
const REPO_OWNER = 'AndrewRichardsDesign';
const REPO_NAME = 'Alvaro-Carito';
/**
 * The branch admin edits are committed to.
 *
 * Injected at build time from the branch the site was deployed from, because
 * the right answer is "wherever this site came from" — hard-coding `main` sends
 * saves to a branch that may not exist, and the failure reads as an auth error.
 */
const DEFAULT_BRANCH = import.meta.env.VITE_DEPLOY_BRANCH || 'main';

/** Said whenever GitHub rejects the credential, wherever in the save it happens. */
const TOKEN_MESSAGE =
  'GitHub rejected that token. It needs to be a fine-grained personal access ' +
  'token from github.com/settings/tokens — it starts with "github_pat_" — with ' +
  'Contents: Read and write on this repository. It is not the site password.';

const DRAFT_KEY = 'ac.content.draft';
const TOKEN_KEY = 'ac.admin.token';
const BRANCH_KEY = 'ac.admin.branch';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

interface ContentContextValue {
  content: SiteContent;
  isAdmin: boolean;
  dirty: boolean;
  token: string;
  branch: string;
  saveState: SaveState;
  /** Whether the reorder/arrange overlay is showing. */
  arrangeMode: boolean;
  setArrangeMode: (on: boolean) => void;
  /** Set any scalar at a dot path, e.g. "sections.2.title". */
  setText: (path: string, value: string | number | boolean) => void;
  /** Set any value (object, array) at a dot path. */
  setValue: (path: string, value: unknown) => void;
  addSection: (type: SectionType, index?: number) => string;
  removeSection: (index: number) => void;
  duplicateSection: (index: number) => void;
  /** Move a section from one index to another (drag and drop). */
  moveSection: (from: number, to: number) => void;
  /** Move an item within any array in the document (drag and drop). */
  moveItem: (path: string, from: number, to: number) => void;
  addItem: (path: string, item: unknown, index?: number) => void;
  removeItem: (path: string, index: number) => void;
  setToken: (token: string) => void;
  setBranch: (branch: string) => void;
  save: () => Promise<void>;
  discardChanges: () => void;
  /** Replace the whole document (used by Import JSON). */
  replaceContent: (next: SiteContent) => void;
  /** Commit an image to the repo's public/uploads folder; returns its path. */
  uploadAsset: (file: File | Blob, filename?: string) => Promise<string>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

/** Base64-encode a UTF-8 string (btoa alone only handles latin1). */
function utf8ToBase64(str: string): string {
  return bytesToBase64(new TextEncoder().encode(str));
}

/** Base64-encode raw bytes in chunks, avoiding call-stack limits. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** A filesystem-safe, unique-ish name for an uploaded asset. */
function safeAssetName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > -1 ? name.slice(dot).toLowerCase() : '.jpg';
  const stem =
    (dot > -1 ? name.slice(0, dot) : name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'photo';
  return `${stem}-${Date.now().toString(36)}${ext}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merge a saved draft over the shipped content. Draft values win, but any key
 * the draft is missing (a field added to the schema after the draft was saved)
 * falls back to the default, so a stale draft can never crash the page.
 *
 * `sections` is deliberately taken wholesale from the draft when present —
 * it is a list the editor owns, and merging it index-by-index would resurrect
 * sections they deleted.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(override)) {
      out[key] =
        key === 'sections' || !(key in base)
          ? override[key]
          : deepMerge((base as Record<string, unknown>)[key], override[key]);
    }
    return out as T;
  }
  return override === undefined ? base : (override as T);
}

function readDraft(): SiteContent | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SiteContent) : null;
  } catch {
    return null;
  }
}

export function ContentProvider({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
  const base = defaultContent as unknown as SiteContent;
  const [content, setContent] = useState<SiteContent>(() => {
    const draft = readDraft();
    return draft ? deepMerge(base, draft) : base;
  });
  const [dirty, setDirty] = useState<boolean>(() => readDraft() != null);
  const [token, setTokenState] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [branch, setBranchState] = useState<string>(
    () => localStorage.getItem(BRANCH_KEY) ?? DEFAULT_BRANCH
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [arrangeMode, setArrangeMode] = useState(false);

  // Reordering reflows the page, which would otherwise yank the viewport around
  // under the editor's cursor. Record the scroll offset before the mutation and
  // restore it pre-paint so nothing visibly moves.
  const scrollRestoreRef = useRef<number | null>(null);
  const requestScrollRestore = useCallback(() => {
    if (typeof window === 'undefined') return;
    scrollRestoreRef.current = window.scrollY;
    document.documentElement.style.overflowAnchor = 'none';
  }, []);
  useLayoutEffect(() => {
    const y = scrollRestoreRef.current;
    if (y == null) return;
    scrollRestoreRef.current = null;
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    let frame = 0;
    const tick = () => {
      if (window.scrollY !== y) window.scrollTo(0, y);
      if (++frame < 8) {
        requestAnimationFrame(tick);
      } else {
        html.style.overflowAnchor = '';
        html.style.scrollBehavior = prevBehavior;
      }
    };
    requestAnimationFrame(tick);
  });

  const persistDraft = useCallback((next: SiteContent) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* quota exceeded — the in-memory edit still stands */
    }
    setDirty(true);
    setSaveState({ status: 'idle' });
  }, []);

  const setValue = useCallback(
    (path: string, value: unknown) => {
      setContent((prev) => {
        if (getByPath(prev, path) === value) return prev;
        const next = setByPath(prev, path, value);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  const setText = useCallback(
    (path: string, value: string | number | boolean) => setValue(path, value),
    [setValue]
  );

  const addSection = useCallback(
    (type: SectionType, index?: number) => {
      const template = SECTION_TEMPLATES.find((t) => t.type === type);
      const section = template ? template.create() : ({ id: newId(type), type } as unknown as Section);
      setContent((prev) => {
        const list = [...prev.sections];
        // Default to just above the footer, which is almost always where you
        // want a new section — never below the closing card.
        const footerAt = list.findIndex((s) => s.type === 'footer');
        const fallback = footerAt === -1 ? list.length : footerAt;
        const at = Math.max(0, Math.min(index ?? fallback, list.length));
        list.splice(at, 0, section);
        const next = { ...prev, sections: list };
        persistDraft(next);
        return next;
      });
      return section.id;
    },
    [persistDraft]
  );

  const removeSection = useCallback(
    (index: number) => {
      requestScrollRestore();
      setContent((prev) => {
        if (index < 0 || index >= prev.sections.length) return prev;
        const list = [...prev.sections];
        list.splice(index, 1);
        const next = { ...prev, sections: list };
        persistDraft(next);
        return next;
      });
    },
    [persistDraft, requestScrollRestore]
  );

  const duplicateSection = useCallback(
    (index: number) => {
      setContent((prev) => {
        if (index < 0 || index >= prev.sections.length) return prev;
        const copy = JSON.parse(JSON.stringify(prev.sections[index])) as Section;
        copy.id = newId(copy.type);
        const list = [...prev.sections];
        list.splice(index + 1, 0, copy);
        const next = { ...prev, sections: list };
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  const moveSection = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      requestScrollRestore();
      setContent((prev) => {
        const list = [...prev.sections];
        if (from < 0 || from >= list.length) return prev;
        const [moved] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(to, list.length)), 0, moved);
        const next = { ...prev, sections: list };
        persistDraft(next);
        return next;
      });
    },
    [persistDraft, requestScrollRestore]
  );

  const moveItem = useCallback(
    (path: string, from: number, to: number) => {
      if (from === to) return;
      setContent((prev) => {
        const arr = getByPath(prev, path);
        if (!Array.isArray(arr) || from < 0 || from >= arr.length) return prev;
        const list = [...arr];
        const [moved] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(to, list.length)), 0, moved);
        const next = setByPath(prev, path, list);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  const addItem = useCallback(
    (path: string, item: unknown, index?: number) => {
      setContent((prev) => {
        const arr = getByPath(prev, path);
        const list = Array.isArray(arr) ? [...arr] : [];
        const at = Math.max(0, Math.min(index ?? list.length, list.length));
        list.splice(at, 0, item);
        const next = setByPath(prev, path, list);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  const removeItem = useCallback(
    (path: string, index: number) => {
      setContent((prev) => {
        const arr = getByPath(prev, path);
        if (!Array.isArray(arr) || index < 0 || index >= arr.length) return prev;
        const list = [...arr];
        list.splice(index, 1);
        const next = setByPath(prev, path, list);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  const replaceContent = useCallback(
    (next: SiteContent) => {
      setContent(next);
      persistDraft(next);
    },
    [persistDraft]
  );

  const setToken = useCallback((value: string) => {
    setTokenState(value);
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setBranch = useCallback((value: string) => {
    const next = value.trim() || DEFAULT_BRANCH;
    setBranchState(next);
    try {
      localStorage.setItem(BRANCH_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const discardChanges = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setContent(base);
    setDirty(false);
    setSaveState({ status: 'idle' });
    setArrangeMode(false);
  }, [base]);

  const save = useCallback(async () => {
    if (!token) {
      setSaveState({ status: 'error', message: 'Paste a GitHub token first.' });
      return;
    }
    setSaveState({ status: 'saving' });
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONTENT_PATH}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      const json = `${JSON.stringify(content, null, 2)}\n`;

      // Read the current blob SHA, bypassing any HTTP cache — a stale SHA gets
      // rejected by GitHub with a 409.
      const fetchSha = async (): Promise<string | undefined> => {
        const res = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, {
          headers,
          cache: 'no-store',
        });
        if (res.ok) return ((await res.json()) as { sha?: string }).sha;
        if (res.status === 404) return undefined; // not committed yet
        // A bad token fails here first, on the read, so it has to be named
        // here too — "could not read the file (401)" tells nobody anything.
        if (res.status === 401 || res.status === 403) throw new Error(TOKEN_MESSAGE);
        throw new Error(`Could not read the existing file (${res.status}).`);
      };

      const commit = (sha: string | undefined) =>
        fetch(apiUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: 'Update wedding site content via admin mode',
            content: utf8ToBase64(json),
            branch,
            sha,
          }),
        });

      let res = await commit(await fetchSha());
      for (let attempt = 0; res.status === 409 && attempt < 2; attempt++) {
        res = await commit(await fetchSha());
      }

      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const err = (await res.json()) as { message?: string };
          if (err.message) detail = err.message;
        } catch {
          /* ignore */
        }
        if (res.status === 401 || res.status === 403) {
          detail = TOKEN_MESSAGE;
        } else if (res.status === 404 || res.status === 422) {
          detail = `The branch "${branch}" doesn't exist in ${REPO_OWNER}/${REPO_NAME}. Check the branch box next to the token.`;
        } else if (res.status === 409) {
          detail = 'The file changed while saving — press Save again.';
        }
        throw new Error(detail);
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDirty(false);
      setSaveState({
        status: 'success',
        message: `Saved to ${branch}. The live site updates in a minute or two.`,
      });
    } catch (e) {
      setSaveState({ status: 'error', message: e instanceof Error ? e.message : 'Save failed.' });
    }
  }, [token, branch, content]);

  const uploadAsset = useCallback(
    async (file: File | Blob, filename?: string): Promise<string> => {
      if (!token) throw new Error('Paste a GitHub token in the admin bar first.');
      const name = safeAssetName(filename ?? (file instanceof File ? file.name : 'photo.jpg'));
      const repoPath = `public/uploads/${name}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${repoPath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            message: `Add photograph ${name} via admin mode`,
            content: bytesToBase64(buffer),
            branch,
          }),
        }
      );
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const err = (await res.json()) as { message?: string };
          if (err.message) detail = err.message;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      // Relative, to match the Vite `base: './'` build.
      return `./uploads/${name}`;
    },
    [token, branch]
  );

  const value = useMemo<ContentContextValue>(
    () => ({
      content, isAdmin, dirty, token, branch, saveState,
      arrangeMode, setArrangeMode,
      setText, setValue,
      addSection, removeSection, duplicateSection, moveSection,
      moveItem, addItem, removeItem,
      setToken, setBranch, save, discardChanges, replaceContent, uploadAsset,
    }),
    [
      content, isAdmin, dirty, token, branch, saveState, arrangeMode,
      setText, setValue, addSection, removeSection, duplicateSection, moveSection,
      moveItem, addItem, removeItem, setToken, setBranch, save, discardChanges,
      replaceContent, uploadAsset,
    ]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

/**
 * Renders children against a throwaway one-section document.
 *
 * The section palette wants to show what a template actually looks like, and
 * every section renderer reads its copy out of the content store by path. So
 * rather than maintaining a second set of mock components that would drift out
 * of step with the real ones, the preview nests a provider whose document
 * contains only the section being previewed, at `sections.0`. Everything else —
 * the theme, the photo store — is the real thing, so a preview is painted in
 * the couple's own colours and typefaces.
 */
export function PreviewContentProvider({
  section,
  children,
}: {
  section: Section;
  children: ReactNode;
}) {
  const real = useContent();
  const value = useMemo<ContentContextValue>(
    () => ({
      ...real,
      // A preview is a picture, not a workspace: no editing affordances, and
      // nothing it does can reach the real document.
      isAdmin: false,
      content: { ...real.content, sections: [section] },
    }),
    [real, section]
  );
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within a ContentProvider');
  return ctx;
}

export const ADMIN_TARGET = { owner: REPO_OWNER, repo: REPO_NAME, path: CONTENT_PATH };
