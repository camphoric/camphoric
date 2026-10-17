/**
 * Show HTML produced by a template (an `html` report, an HTML preview) in a
 * sandboxed frame (SPEC §9.6, §11). The frame never runs scripts or submits
 * forms, and the report's own styles stay inside it. Its height follows the
 * content.
 */

import { useCallback, useRef, useState } from 'react';

interface HtmlFrameProps {
  html: string;
  title: string;
  minHeight?: number;
}

export function HtmlFrame({ html, title, minHeight = 200 }: HtmlFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  const measure = useCallback(() => {
    // Same-origin (but script-free) so the page can read the content's height.
    const body = frame.current?.contentDocument?.documentElement;
    if (body) setHeight(Math.max(minHeight, body.scrollHeight + 16));
  }, [minHeight]);

  return (
    <iframe
      ref={frame}
      title={title}
      // No allow-scripts: the frame's content can't run code, so granting
      // same-origin (for measuring) doesn't give it access to the page.
      sandbox="allow-same-origin"
      srcDoc={html}
      onLoad={measure}
      style={{
        width: '100%',
        height,
        border: '1px solid var(--mantine-color-default-border)',
        background: 'white',
        borderRadius: 4,
      }}
    />
  );
}
