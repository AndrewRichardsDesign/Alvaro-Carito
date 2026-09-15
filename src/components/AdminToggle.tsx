import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { tryUnlockAdmin } from '@/lib/adminAuth';

/**
 * The way in. A discreet link in the footer area opens a password prompt; the
 * correct password reveals the editing tools for the rest of the tab session.
 *
 * This is a soft gate, not a security boundary — the password is in the bundle,
 * like any client-side check. What actually protects the live site is that
 * publishing a change needs a GitHub token with write access to the repository.
 */
export function AdminToggle({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (isAdmin) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tryUnlockAdmin(password)) {
      setOpen(false);
      setPassword('');
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <>
      <div className="flex justify-center bg-canvas pb-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] uppercase tracking-[0.25em] text-muted/60 transition-colors hover:text-accent"
        >
          Edit this site
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 sm:mx-0">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Admin</DialogTitle>
            <DialogDescription>
              Enter the password to edit the site. You'll be able to change any text, photograph,
              colour and the order of the page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Password"
              aria-invalid={error}
              aria-label="Admin password"
            />
            {error && <p className="-mt-2 text-xs text-destructive">That isn't the password.</p>}
            <DialogFooter>
              <Button type="submit" className="w-full">Unlock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
