import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Returns the next wrapped focus position for a modal Tab sequence. */
export function nextFocusIndex(currentIndex: number, count: number, direction: -1 | 1): number {
  if (count <= 0) return -1;
  if (currentIndex < 0) return direction === 1 ? 0 : count - 1;
  return (currentIndex + direction + count) % count;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest('[hidden]')) return false;
    return element.getClientRects().length > 0 || element === document.activeElement;
  });
}

function focusElement(element: HTMLElement | null): void {
  if (!element || !document.contains(element)) return;
  element.focus({ preventScroll: true });
}

export type ModalFocusScope = {
  ref: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: ModalKeyEvent) => void;
};

type ModalKeyEvent = Pick<globalThis.KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault' | 'stopPropagation'>;

/**
 * Keeps keyboard focus inside the active overlay and returns it to the opener
 * when the overlay closes. A changing scope key switches panels without
 * restoring focus to an intermediate control.
 */
export function useModalFocusScope(scopeKey: string | null, onEscape: (() => void) | null): ModalFocusScope {
  const ref = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef(false);

  useLayoutEffect(() => {
    if (scopeKey) {
      if (!activeRef.current) {
        const active = document.activeElement;
        restoreRef.current = active instanceof HTMLElement ? active : null;
      }
      activeRef.current = true;
      const root = ref.current;
      if (root) {
        const elements = focusableElements(root);
        focusElement(elements[0] ?? root);
      }
      return;
    }

    if (activeRef.current) {
      activeRef.current = false;
      const previous = restoreRef.current;
      restoreRef.current = null;
      focusElement(previous);
    }
  }, [scopeKey]);

  const onKeyDown = useCallback((event: ModalKeyEvent): void => {
    if (!scopeKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const root = ref.current;
    if (!root) return;
    const elements = focusableElements(root);
    if (elements.length === 0) {
      event.preventDefault();
      root.focus({ preventScroll: true });
      return;
    }
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = nextFocusIndex(currentIndex, elements.length, event.shiftKey ? -1 : 1);
    if (nextIndex < 0) return;
    event.preventDefault();
    focusElement(elements[nextIndex] ?? null);
  }, [onEscape, scopeKey]);

  useEffect(() => {
    if (!scopeKey) return;
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent): void => {
      const root = ref.current;
      if (root?.contains(event.target as Node)) return;
      onKeyDown(event);
    };
    document.addEventListener('keydown', onDocumentKeyDown, true);
    return () => document.removeEventListener('keydown', onDocumentKeyDown, true);
  }, [onKeyDown, scopeKey]);

  return { ref, onKeyDown };
}
