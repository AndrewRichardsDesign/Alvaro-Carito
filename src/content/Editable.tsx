import { useEffect, useRef } from 'react';
import type { ElementType } from 'react';
import { cn } from '@/lib/utils';
import { getByPath } from '@/lib/paths';
import { useContent } from './ContentContext';

type EditableTag = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'a' | 'li' | 'blockquote' | 'figcaption';

interface EditableProps {
  /** Dot path into the content store, e.g. "sections.0.names". */
  path: string;
  as?: EditableTag;
  className?: string;
  /** Allow line breaks (Enter inserts a newline instead of committing). */
  multiline?: boolean;
  /** Ghost text shown when the field is empty, so it stays clickable. */
  placeholder?: string;
  /** Hide the element entirely when empty and not editing. */
  hideWhenEmpty?: boolean;
  [key: string]: unknown;
}

/**
 * A piece of editable copy.
 *
 * Outside admin mode it renders plain text. In admin mode the element becomes
 * `contentEditable` and its text is driven imperatively through a ref, so React
 * never reconciles the text node mid-keystroke (which drops characters). The
 * value is committed to the store on blur.
 */
export function Editable({
  path,
  as = 'span',
  className,
  multiline = false,
  placeholder,
  hideWhenEmpty = false,
  ...rest
}: EditableProps) {
  const { content, isAdmin, setText } = useContent();
  const value = String(getByPath(content, path) ?? '');
  const ref = useRef<HTMLElement>(null);
  const Tag = as as ElementType;

  // Keep the DOM in sync with the store, but never while the field has focus.
  useEffect(() => {
    const el = ref.current;
    if (!isAdmin || !el) return;
    if (document.activeElement !== el && el.innerText !== value) {
      el.innerText = value;
    }
  }, [isAdmin, value]);

  if (!isAdmin) {
    if (!value && hideWhenEmpty) return null;
    return (
      <Tag className={className} {...rest}>
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={cn('admin-editable', className)}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-editable-path={path}
      data-placeholder={placeholder ?? 'Click to write…'}
      title={path}
      onBlur={(e: React.FocusEvent<HTMLElement>) =>
        setText(path, e.currentTarget.innerText.replace(/\u00a0/g, ' ').trimEnd())
      }
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onPointerDown={(e: React.PointerEvent) => {
        // Don't let a click-to-edit start a drag on an ancestor drag handle.
        e.stopPropagation();
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        if (as === 'a') e.preventDefault();
      }}
      {...rest}
    />
  );
}
