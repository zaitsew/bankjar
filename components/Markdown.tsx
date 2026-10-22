import Link from "next/link";
import type { ReactNode } from "react";
import { parseBlocks } from "./markdown-parse";

/**
 * A small markdown renderer for our own docs: headings, paragraphs, lists, tables,
 * code fences, **bold**, *italic*, `code` and [links](url). No raw HTML is ever passed through.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g;

function safeHref(href: string): string | null {
  return /^(https?:\/\/|\/|#|mailto:)/.test(href) ? href : null;
}

function inline(text: string, keyBase = "k"): ReactNode[] {
  return text.split(INLINE).map((part, idx) => {
    const key = `${keyBase}-${idx}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key}>{inline(part.slice(2, -2), key)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key} className="inline">{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]!);
      if (!href) return link[1];
      return href.startsWith("/") || href.startsWith("#") ? (
        <Link key={key} href={href}>
          {link[1]}
        </Link>
      ) : (
        <a key={key} href={href} rel="nofollow noopener">
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** "Bank apps" -> "bank-apps": the anchor for links such as /methodology#bank-apps. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function Markdown({ source, skipTitle = false }: { source: string; skipTitle?: boolean }) {
  const blocks = parseBlocks(source);
  const list = skipTitle && blocks[0]?.t === "h" && blocks[0].level === 1 ? blocks.slice(1) : blocks;
  return (
    <div className="prose">
      {list.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.t) {
          case "h": {
            const id = headingId(b.text);
            if (b.level <= 2) return <h2 key={key} id={id}>{inline(b.text, key)}</h2>;
            return <h3 key={key} id={id}>{inline(b.text, key)}</h3>;
          }
          case "p":
            return <p key={key}>{inline(b.text, key)}</p>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={key}>
                {b.items.map((it, n) => (
                  <li key={`${key}-${n}`}>{inline(it, `${key}-${n}`)}</li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={key} className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, n) => (
                        <th key={n} scope="col">
                          {inline(c, `${key}-h${n}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, n) => (
                      <tr key={n}>
                        {r.map((c, m) =>
                          m === 0 ? (
                            <th key={m} scope="row">
                              {inline(c, `${key}-${n}-${m}`)}
                            </th>
                          ) : (
                            <td key={m}>{inline(c, `${key}-${n}-${m}`)}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <pre key={key} className="code">
                <code>{b.text}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
