// Lightweight Markdown renderer for AI chat replies — no external dependency.
//
// Supports the subset of Markdown chat models actually emit: fenced code
// blocks (with language + copy button), headings, bold/italic, inline code,
// links, bullet & numbered lists, blockquotes, tables, and horizontal rules.
// Everything is rendered as React nodes (never innerHTML), so model output
// cannot inject markup.
import { useState } from 'react';
import { Icon } from '../../components/ui/index.jsx';

// ---------------------------------------------------------------------------
// Inline formatting: **bold**, *italic*, `code`, [text](url)
// ---------------------------------------------------------------------------
const INLINE_RE =
  /(\*\*([^*\n]+)\*\*)|(\*([^*\n]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g;

function renderInline(text, keyPrefix = 'i') {
  const source = String(text ?? '');
  const nodes = [];
  let cursor = 0;
  let index = 0;

  // matchAll() clones the regex, so nested renderInline() calls (bold inside a
  // bold segment, etc.) can never corrupt this loop's lastIndex — sharing the
  // module-level regex with exec() here caused an infinite loop and crashed
  // the tab on the first reply that contained **bold** text.
  for (const match of source.matchAll(INLINE_RE)) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));

    const key = `${keyPrefix}-${index++}`;
    if (match[2] != null) {
      nodes.push(<strong key={key}>{renderInline(match[2], key)}</strong>);
    } else if (match[4] != null) {
      nodes.push(<em key={key}>{renderInline(match[4], key)}</em>);
    } else if (match[6] != null) {
      nodes.push(<code key={key}>{match[6]}</code>);
    } else if (match[8] != null) {
      nodes.push(
        <a key={key} href={match[9]} target="_blank" rel="noreferrer noopener">
          {match[8]}
        </a>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

/** Split a paragraph on single newlines → <br/> (chat replies rely on them). */
function renderParagraphLines(text, keyPrefix) {
  const parts = String(text ?? '').split('\n');
  return parts.flatMap((part, i) =>
    i === 0
      ? renderInline(part, `${keyPrefix}-0`)
      : [<br key={`${keyPrefix}-br-${i}`} />, ...renderInline(part, `${keyPrefix}-${i}`)]
  );
}

// ---------------------------------------------------------------------------
// Block-level renderer
// ---------------------------------------------------------------------------
function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="ai-code">
      <div className="ai-code__bar">
        <span className="ai-code__lang">{lang || 'code'}</span>
        <button type="button" onClick={copy} className="ai-code__copy">
          <Icon name={copied ? 'check' : 'content_copy'} size={13} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

const FENCE_OPEN_RE = /^\s*```(.*)$/;
const FENCE_CLOSE_RE = /^\s*```\s*$/;
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const HR_RE = /^\s*(?:[-*_]\s*){3,}$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;

function splitTableRow(row) {
  return row
    .split('|')
    .map((cell) => cell.trim());
}

function parseTable(lines, start) {
  const header = splitTableRow(lines[start].match(TABLE_ROW_RE)[1]);
  const rows = [];
  let i = start + 2; // skip the separator row
  while (i < lines.length) {
    const match = lines[i].match(TABLE_ROW_RE);
    if (!match) break;
    rows.push(splitTableRow(match[1]));
    i += 1;
  }
  return { header, rows, next: i };
}

export function renderMarkdown(source) {
  const text = String(source ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  const nextKey = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block -------------------------------------------------------
    const fence = line.match(FENCE_OPEN_RE);
    if (fence) {
      const lang = fence[1].trim();
      const code = [];
      i += 1;
      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // consume the closing fence
      blocks.push(<CodeBlock key={nextKey()} lang={lang} code={code.join('\n')} />);
      continue;
    }

    // Heading -----------------------------------------------------------------
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(level + 1, 4)}`; // # → h2 … #### → h4
      blocks.push(<Tag key={nextKey()}>{renderInline(heading[2], nextKey())}</Tag>);
      i += 1;
      continue;
    }

    // Horizontal rule -----------------------------------------------------------
    if (HR_RE.test(line)) {
      blocks.push(<hr key={nextKey()} />);
      i += 1;
      continue;
    }

    // Table --------------------------------------------------------------------
    if (TABLE_ROW_RE.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const { header, rows, next } = parseTable(lines, i);
      blocks.push(
        <div key={nextKey()} className="ai-table-wrap">
          <table>
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th key={c}>{renderInline(cell, `th-${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{renderInline(cell, `td-${r}-${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = next;
      continue;
    }

    // Blockquote -----------------------------------------------------------------
    const quote = line.match(QUOTE_RE);
    if (quote) {
      const quoted = [quote[1]];
      i += 1;
      while (i < lines.length) {
        const more = lines[i].match(QUOTE_RE);
        if (!more) break;
        quoted.push(more[1]);
        i += 1;
      }
      blocks.push(
        <blockquote key={nextKey()}>
          {quoted.map((part, q) => (
            <p key={q}>{renderInline(part, `q-${q}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Lists ---------------------------------------------------------------------
    const bullet = line.match(BULLET_RE);
    const ordered = line.match(ORDERED_RE);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        const nextBullet = current.match(BULLET_RE);
        const nextOrdered = current.match(ORDERED_RE);
        if (isOrdered && nextOrdered) {
          items.push(nextOrdered[2]);
        } else if (!isOrdered && nextBullet) {
          items.push(nextBullet[1]);
        } else if (current.trim() && /^\s{2,}\S/.test(current) && items.length > 0) {
          // Indented continuation line → append to the previous item.
          items[items.length - 1] += ` ${current.trim()}`;
        } else {
          break;
        }
        i += 1;
      }
      const Tag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={nextKey()}>
          {items.map((item, li) => (
            <li key={li}>{renderInline(item, `li-${li}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    // Blank line ------------------------------------------------------------------
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Paragraph: consume until a blank line or the start of another block. ------
    const paragraph = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      if (
        !next.trim() ||
        FENCE_OPEN_RE.test(next) ||
        HEADING_RE.test(next) ||
        HR_RE.test(next) ||
        BULLET_RE.test(next) ||
        ORDERED_RE.test(next) ||
        QUOTE_RE.test(next) ||
        TABLE_ROW_RE.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      i += 1;
    }
    blocks.push(
      <p key={nextKey()}>{renderParagraphLines(paragraph.join('\n'), nextKey())}</p>
    );
  }

  return blocks;
}

/** Styled wrapper around renderMarkdown. */
export default function Markdown({ children }) {
  return <div className="ai-md">{renderMarkdown(children)}</div>;
}
