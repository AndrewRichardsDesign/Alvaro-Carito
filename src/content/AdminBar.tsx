import { useRef, useState } from 'react';
import {
  Check, Download, ExternalLink, Eye, EyeOff, List, Loader2, LogOut, Move, Palette, Plus,
  RotateCcw, Save, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddSectionMenu } from '@/sections/AddSectionMenu';
import { lockAdmin } from '@/lib/adminAuth';
import { saveBlob } from '@/lib/zip';
import { ADMIN_TARGET, useContent } from './ContentContext';
import { ContentEditorPanel } from './ContentEditorPanel';
import { ThemePanel } from './ThemePanel';
import type { SiteContent } from './types';

/**
 * The floating admin toolbar.
 *
 * Saving commits `site-content.json` straight to the repository with a
 * fine-grained GitHub token the editor pastes in — which is also the real
 * security boundary here. The password on the door only decides who sees the
 * editing tools; the token decides who can actually change the live site.
 */
export function AdminBar() {
  const {
    isAdmin, dirty, token, branch, saveState, content,
    arrangeMode, setArrangeMode,
    setToken, setBranch, save, discardChanges, replaceContent,
  } = useContent();
  const [showToken, setShowToken] = useState(false);
  const [open, setOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) return null;

  const saving = saveState.status === 'saving';

  const exportJson = () =>
    saveBlob(
      new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: 'application/json' }),
      'site-content.json'
    );

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as SiteContent;
      if (!parsed || !Array.isArray(parsed.sections)) throw new Error('missing sections');
      replaceContent(parsed);
    } catch {
      alert("That file doesn't look like a site-content.json export.");
    }
  };

  return (
    <>
      <ContentEditorPanel open={fieldsOpen} onClose={() => setFieldsOpen(false)} />
      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} />

      {arrangeMode && (
        <div className="admin-surface fixed left-1/2 top-4 z-[100] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-primary/30 bg-background/95 px-4 py-1.5 text-center text-xs font-medium !text-primary shadow-lg backdrop-blur">
          Drag a section by its handle to move it. Arrow keys work too.
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2">
        <div className="admin-surface rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-primary" />
              <span className="text-sm font-semibold">Admin</span>
              {dirty ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                  Unsaved
                </span>
              ) : (
                <span className="hidden text-xs text-muted-foreground sm:inline">All saved</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen((v) => !v)}>
                {open ? 'Hide saving' : 'Saving'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Leave admin mode"
                onClick={() => {
                  setArrangeMode(false);
                  lockAdmin();
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
            <Button
              size="sm"
              variant={arrangeMode ? 'default' : 'outline'}
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setArrangeMode(!arrangeMode)}
            >
              <Move className="h-3.5 w-3.5" />
              {arrangeMode ? 'Done arranging' : 'Arrange'}
            </Button>

            <AddSectionMenu
              align="start"
              trigger={
                <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add section
                </Button>
              }
            />

            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => setThemeOpen(true)}>
              <Palette className="h-3.5 w-3.5" /> Look
            </Button>

            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => setFieldsOpen(true)}>
              <List className="h-3.5 w-3.5" /> All fields
            </Button>

            <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
              Click any text to edit it
            </span>
          </div>

          {open && (
            <div className="space-y-3 border-t border-border/60 px-4 py-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  GitHub token — fine-grained, with “Contents: write” on this repository
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="github_pat_…"
                      autoComplete="off"
                      spellCheck={false}
                      className="h-9 pr-9 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showToken ? 'Hide the token' : 'Show the token'}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="branch"
                    spellCheck={false}
                    title="Branch to commit to"
                    className="h-9 w-28 text-xs"
                  />
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Commits to <code className="rounded bg-muted px-1 py-0.5">{ADMIN_TARGET.owner}/{ADMIN_TARGET.repo}</code>{' '}
                  at <code className="rounded bg-muted px-1 py-0.5">{ADMIN_TARGET.path}</code>. The token is kept in
                  this browser only, and is sent to GitHub and nowhere else.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save to GitHub'}
                </Button>
                <Button size="sm" variant="outline" onClick={discardChanges} disabled={!dirty || saving} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" /> Discard
                </Button>
                <Button size="sm" variant="outline" onClick={exportJson} className="gap-1.5" title="Download a backup">
                  <Download className="h-4 w-4" /> Export
                </Button>
                <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="gap-1.5" title="Restore a backup">
                  <Upload className="h-4 w-4" /> Import
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importJson(file);
                    e.target.value = '';
                  }}
                />
                <a
                  href={`https://github.com/${ADMIN_TARGET.owner}/${ADMIN_TARGET.repo}/commits/${branch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  History <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {saveState.status === 'success' && (
                <Status tone="ok" icon={<Check className="mt-0.5 h-4 w-4 flex-shrink-0" />}>
                  {saveState.message}
                </Status>
              )}
              {saveState.status === 'error' && (
                <Status tone="bad" icon={<X className="mt-0.5 h-4 w-4 flex-shrink-0" />}>
                  {saveState.message}
                </Status>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Status({ tone, icon, children }: { tone: 'ok' | 'bad'; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
        tone === 'ok' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'
      }`}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}
