import { Fragment, type ReactNode } from "react";

/**
 * Paraglide compiles next-intl `t.rich("key", { accent })` messages to PLAIN
 * strings containing literal `<accent>…</accent>` markup — no tag substitution.
 * This splits such a message and wraps each accented chunk with `wrap`, leaving
 * the surrounding text as-is. Mirrors the old rich-text render callback.
 *
 *   renderAccent(m.landing_hero_title(), (c) => <span className="…">{c}</span>)
 */
export function renderAccent(
  message: string,
  wrap: (chunk: string) => ReactNode,
): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /<accent>([\s\S]*?)<\/accent>/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    if (match.index > lastIndex) parts.push(message.slice(lastIndex, match.index));
    parts.push(<Fragment key={key++}>{wrap(match[1])}</Fragment>);
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < message.length) parts.push(message.slice(lastIndex));
  return parts;
}
