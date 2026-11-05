/**
 * Markdown the pipeline has rendered (SPEC §9.3), in its `.md-template`
 * wrapper. A table's box that scrolls (the table is wider than its column)
 * takes keyboard focus as a labelled group, so the keyboard can scroll it in
 * every browser: Safari doesn't make a scrolling box focusable on its own. A
 * box that doesn't scroll takes no focus, adding no stop to the tab order.
 */

import './markdown.css';

import { useLayoutEffect, useRef } from 'react';

import { TABLE_SCROLL_CLASS } from './pipeline';

/** What a scrolling table's box is called, to a screen reader. */
export const SCROLLING_TABLE_LABEL = 'Table, scrolls sideways';

/**
 * Make a table's box focusable while it scrolls, and not otherwise. (A group,
 * not a region: a page can hold several, and landmarks should differ by name.)
 */
function updateTableBox(box: HTMLElement) {
  const overflowX = getComputedStyle(box).overflowX;
  const scrolls =
    (overflowX === 'auto' || overflowX === 'scroll') && box.scrollWidth > box.clientWidth;
  if (scrolls) {
    box.tabIndex = 0;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', SCROLLING_TABLE_LABEL);
  } else if (box !== document.activeElement) {
    // (One that has focus keeps it, for the keyboard not to lose its place)
    box.removeAttribute('tabindex');
    box.removeAttribute('role');
    box.removeAttribute('aria-label');
  }
}

interface RenderedMarkdownProps {
  /** HTML from markdownToHtml or templateToHtml, which sanitize it. */
  html: string;
}

export function RenderedMarkdown({ html }: RenderedMarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The boxes come with the HTML, so they're looked at again when it changes,
  // and whenever a box or its table changes size (the screen turns, a font
  // loads). Before the browser paints, so a box is never seen without its focus.
  useLayoutEffect(() => {
    const boxes = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(`.${TABLE_SCROLL_CLASS}`) ?? [],
    );
    boxes.forEach(updateTableBox);
    if (boxes.length === 0 || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        const box = target.closest<HTMLElement>(`.${TABLE_SCROLL_CLASS}`);
        if (box) updateTableBox(box);
      }
    });
    for (const box of boxes) {
      observer.observe(box);
      if (box.firstElementChild) observer.observe(box.firstElementChild);
    }
    return () => observer.disconnect();
  }, [html]);

  // Safe: the HTML is sanitized by rehype-sanitize in the pipeline (§11).
  return <div ref={ref} className="md-template" dangerouslySetInnerHTML={{ __html: html }} />;
}
