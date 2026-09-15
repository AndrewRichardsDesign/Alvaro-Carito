/**
 * Keyboard reordering, so moving something never depends on being able to
 * drag — which matters on a touchscreen, with a trackpad, or for anybody using
 * a keyboard to navigate.
 */
export function moveWithKeyboard(
  e: React.KeyboardEvent,
  index: number,
  count: number,
  onReorder: (from: number, to: number) => void
): void {
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    if (index > 0) {
      e.preventDefault();
      onReorder(index, index - 1);
    }
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    if (index < count - 1) {
      e.preventDefault();
      onReorder(index, index + 1);
    }
  }
}
