/** Block parser for our own docs. Pure, so it can be tested without React. */

export type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "list"; ordered: boolean; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "code"; text: string };

const ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) buf.push(lines[i++] ?? "");
      i++;
      out.push({ t: "code", text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      out.push({ t: "h", level: h[1]!.length, text: h[2]! });
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) rows.push(cells(lines[i++] ?? ""));
      const [head = [], , ...body] = rows; // rows[1] is the |---| separator
      out.push({ t: "table", head, rows: body });
      continue;
    }
    const li = ITEM.exec(line);
    if (li) {
      const ordered = /\d/.test(li[2]!);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const m = ITEM.exec(cur);
        if (m && /\d/.test(m[2]!) === ordered) {
          items.push(m[3]!);
          i++;
        } else if (cur.trim() !== "" && /^\s+\S/.test(cur) && items.length > 0) {
          items[items.length - 1] += ` ${cur.trim()}`;
          i++;
        } else break;
      }
      out.push({ t: "list", ordered, items });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^(#{1,4}\s|```|\|)/.test(lines[i] ?? "") &&
      !ITEM.test(lines[i] ?? "")
    ) {
      buf.push((lines[i++] ?? "").trim());
    }
    out.push({ t: "p", text: buf.join(" ") });
  }
  return out;
}

