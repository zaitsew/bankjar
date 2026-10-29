import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { GET as challengeGET } from "../app/.well-known/openai-apps-challenge/route";
import { GET as llmsGET } from "../app/llms.txt/route";
import ConnectPage from "../app/connect/page";
import PrivacyPage from "../app/privacy/page";
import sitemap from "../app/sitemap";
import DataDeletionPage from "../app/data-deletion/page";
import SupportPage from "../app/support/page";
import TermsPage from "../app/terms/page";
import { Footer } from "../components/Footer";
import { contactEmail } from "../components/site";
import { AI_MODEL, AI_TIMEOUT_MS } from "../src/server/ai";
import { CACHE_MAX_ENTRIES, CACHE_TTL_MS } from "../src/server/cache";
import { AI_PER_IP_PER_HOUR } from "../src/server/ratelimit";
import { SITE, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);
afterEach(() => {
  delete process.env.OPENAI_APPS_CHALLENGE;
  delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  process.env.BANKJAR_TODAY = "2026-10-21";
});

const html = (page: () => unknown) => renderToStaticMarkup(createElement(page as never));
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ");
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

describe("/.well-known/openai-apps-challenge", () => {
  it("is 404 while OPENAI_APPS_CHALLENGE is unset or blank", async () => {
    expect(challengeGET().status).toBe(404);
    process.env.OPENAI_APPS_CHALLENGE = "   ";
    const res = challengeGET();
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("returns exactly the token as plain text: no JSON, no newline", async () => {
    process.env.OPENAI_APPS_CHALLENGE = "  tok_3fA9-xyz \n";
    const res = challengeGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("tok_3fA9-xyz");
  });

  it("reads the variable at request time", async () => {
    process.env.OPENAI_APPS_CHALLENGE = "one";
    expect(await challengeGET().text()).toBe("one");
    process.env.OPENAI_APPS_CHALLENGE = "two";
    expect(await challengeGET().text()).toBe("two");
  });

  it("is documented where the deploy reads its environment", () => {
    for (const f of [".env.example", "deploy/droplet/.env.example"]) expect(read(f), f).toContain("OPENAI_APPS_CHALLENGE");
  });
});

describe("contact address", () => {
  it("is null until a valid address is set at build time", () => {
    expect(contactEmail()).toBeNull();
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "not an address";
    expect(contactEmail()).toBeNull();
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = " hello@example.org ";
    expect(contactEmail()).toBe("hello@example.org");
  });

  it("names GitHub issues as the only channel when unset, and adds the address when set", () => {
    const unset = text(html(PrivacyPage));
    expect(unset).toContain("There is no e-mail address yet");
    expect(html(PrivacyPage)).not.toContain("mailto:");
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "hello@example.org";
    for (const page of [PrivacyPage, TermsPage, SupportPage]) {
      const h = html(page);
      expect(h).toContain('href="mailto:hello@example.org"');
      expect(h).toContain("https://github.com/zaitsew/bankjar/issues");
      expect(text(h)).not.toContain("There is no e-mail address yet");
    }
  });
});

describe("/privacy", () => {
  const h = () => html(PrivacyPage);

  it("covers categories, purposes, recipients, retention, controls and contact", () => {
    const t = text(h());
    expect(t).toContain("Privacy policy");
    for (const s of ["Data we handle, and why", "Providers that receive data", "Your choices", "Contact", "How long", "Why"]) expect(t, s).toContain(s);
    expect(t).toContain("Ivan Zaitsev (Fabrique Futur)");
  });

  it("names every provider that receives data", () => {
    const t = text(h());
    for (const s of ["Anthropic", "accounts hub", "DigitalOcean", "GitHub", "Claude, ChatGPT or Codex"]) expect(t, s).toContain(s);
  });

  it("states the figures the code uses", () => {
    const t = text(h());
    expect(t).toContain(`${AI_PER_IP_PER_HOUR} per address per hour`);
    expect(t).toContain(`At most ${CACHE_MAX_ENTRIES} entries`);
    expect(t).toContain(`${CACHE_TTL_MS / 3_600_000} hours, or until a restart`);
    expect(t).toContain(`slow (${AI_TIMEOUT_MS / 1000} seconds)`);
    expect(t).toContain("500 characters");
    expect(AI_MODEL).toContain("haiku");
  });

  it("says no accounts, no analytics and one cookie", () => {
    const t = text(h());
    expect(t).toContain("no accounts, no sign-in");
    expect(t).toContain("No analytics, advertising, tracking pixels");
    expect(t).toContain("bj_v");
  });
});

describe("the privacy page matches the code", () => {
  const SOURCE_DIRS = ["app", "components", "src"];
  function sources(): Array<{ file: string; code: string }> {
    const out: Array<{ file: string; code: string }> = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push({ file: full, code: fs.readFileSync(full, "utf8") });
      }
    };
    for (const d of SOURCE_DIRS) walk(path.join(process.cwd(), d));
    return out;
  }

  it("has no analytics or tracking SDK and no browser storage", () => {
    const banned = /google-analytics|googletagmanager|gtag\(|posthog|plausible|umami|mixpanel|segment\.com|sentry|hotjar|clarity\.ms|fbq\(|localStorage|sessionStorage|indexedDB/i;
    const hits = sources()
      .filter((s) => !s.file.endsWith("tests/directory.test.ts") && banned.test(s.code))
      .map((s) => path.relative(process.cwd(), s.file));
    expect(hits).toEqual([]);
  });

  it("sets no cookie but bj_v", () => {
    const assigned = sources().flatMap((s) => [...s.code.matchAll(/document\.cookie\s*=\s*[`"']([a-z_0-9]+)=/gi)].map((m) => m[1]));
    expect(assigned.length).toBeGreaterThan(0);
    expect(new Set(assigned)).toEqual(new Set(["bj_v"]));
    expect(sources().some((s) => /\bcookies\(\)\s*\.set\(|Set-Cookie/i.test(s.code))).toBe(false);
  });

  it("loads nothing from another origin", () => {
    const external = sources()
      .filter((s) => /\.tsx$/.test(s.file) && !/app\/(connect|privacy|terms|support|agents|methodology)\//.test(s.file))
      .flatMap((s) => [...s.code.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=["'](https?:\/\/[^"']+)/g)].map((m) => `${path.relative(process.cwd(), s.file)} ${m[1]}`));
    expect(external).toEqual([]);
  });

  it("sends the AI the question text only, cut to 500 characters, with the daily pseudonym", () => {
    const ai = read("src/server/ai.ts");
    expect(ai).toContain("text.slice(0, 500)");
    expect(ai).toContain('"x-accounts-external-user": opts.visitorId');
    expect(ai).not.toMatch(/x-forwarded-for|opts\.ip|\bip\b\s*[:,]/);
    // The fallback log line never carries the question.
    expect(ai).toMatch(/console\.warn\(`\[bankjar-ai\] fallback to rules: \$\{reason\}`\)/);
  });

  it("hashes the address with a salt and the UTC day before it goes anywhere", () => {
    const rl = read("src/server/ratelimit.ts");
    expect(rl).toContain("sha256");
    expect(rl).toContain(".slice(0, 16)");
    expect(rl).toContain("toISOString().slice(0, 10)");
  });

  it("writes no request, question or profile to a log", () => {
    const logging = sources()
      .filter((s) => !s.file.includes(`${path.sep}scripts${path.sep}`))
      .flatMap((s) => [...s.code.matchAll(/console\.(log|info|debug|warn|error)\(([^)]*)\)/g)].map((m) => `${path.relative(process.cwd(), s.file)}: ${m[0]}`));
    expect(logging).toEqual(["src/server/ai.ts: console.warn(`[bankjar-ai] fallback to rules: ${reason}`)"]);
  });
});

describe("/terms", () => {
  it("says information only, not advice, no warranty, and names both licences", () => {
    const t = text(html(TermsPage));
    expect(t).toContain("not financial advice");
    expect(t).toContain("does not open accounts");
    expect(t).toContain("without any warranty");
    expect(t).toContain("CC BY 4.0");
    expect(t).toContain("Apache License 2.0");
    expect(t).toContain("Ivan Zaitsev (Fabrique Futur)");
    expect(t).toContain("BankJar (github.com/zaitsew/bankjar)");
  });
});

describe("/support", () => {
  it("links the issue tracker and the private security form", () => {
    const h = html(SupportPage);
    expect(h).toContain('href="https://github.com/zaitsew/bankjar/issues/new"');
    expect(h).toContain("https://github.com/zaitsew/bankjar/security/advisories/new");
    expect(h).toContain('href="/connect"');
  });

  it("reports freshness: everything fresh on the fixtures' day", () => {
    const t = text(html(SupportPage));
    expect(t).toContain("Offers in the dataset 4");
    expect(t).toContain("Latest check 20 Oct 2026 (1 day ago)");
    expect(t).toMatch(/Fresh \(checked in the last 30 days\) 4 /);
    expect(t).toMatch(/Stale \(flagged, terms may have changed\) 0 /);
    expect(t).toMatch(/older than 60 days or expired; in no ranking\) 0/);
  });

  it("counts stale and hidden offers as the clock moves on", () => {
    process.env.BANKJAR_TODAY = "2026-12-15";
    const t = text(html(SupportPage));
    // 20 Oct (56 days) and 18 Oct (58 days) are stale; 15 Oct (61) and 10 Oct (66) are hidden.
    expect(t).toMatch(/Fresh \(checked in the last 30 days\) 0 /);
    expect(t).toMatch(/Stale \(flagged, terms may have changed\) 2 /);
    expect(t).toMatch(/older than 60 days or expired; in no ranking\) 2/);
  });
});

describe("/connect", () => {
  const h = () => html(ConnectPage);

  it("shows the server URL and the steps for Claude, ChatGPT and Codex", () => {
    const t = text(h());
    expect(h()).toContain(`${SITE}/mcp`);
    for (const s of ["Claude (claude.ai and Claude Desktop)", "ChatGPT", "Codex and Claude Code", "Add custom connector", "Add custom MCP server", "config.toml", "claude mcp add --transport http bankjar"]) {
      expect(t, s).toContain(s);
    }
    expect(h()).toContain("https://claude.ai/customize/connectors");
    expect(h()).toContain("https://chatgpt.com/plugins");
  });

  it("lists exactly the five tools the MCP server registers", () => {
    const mcp = read("src/server/mcp.ts");
    const registered = [...mcp.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(registered).toHaveLength(5);
    for (const name of registered) expect(h(), name).toContain(`>${name}</code>`);
  });
});

describe("site-wide links", () => {
  const PAGES = ["/privacy", "/terms", "/support", "/connect"];

  it("the footer links all four pages", () => {
    const h = renderToStaticMarkup(createElement(Footer as never));
    for (const p of PAGES) expect(h, p).toContain(`href="${p}"`);
  });

  it("the sitemap lists them", () => {
    const urls = sitemap().map((e) => e.url);
    for (const p of PAGES) expect(urls, p).toContain(`${SITE}${p}`);
  });

  it("llms.txt links them", async () => {
    const t = await llmsGET().text();
    for (const p of PAGES) expect(t, p).toContain(`](${SITE}${p})`);
  });
});

describe("the directory listing pack", () => {
  const plugin = JSON.parse(read("directory", "openai-plugin", ".codex-plugin", "plugin.json"));
  const ui = plugin.interface;
  const review = plugin.extensions["com.openai"].review;
  const doc = read("docs", "DIRECTORY.md");

  it("fits the OpenAI listing limits", () => {
    expect(ui.displayName.length).toBeLessThanOrEqual(30);
    expect(ui.shortDescription.length).toBeLessThanOrEqual(30);
    expect(ui.longDescription.length).toBeLessThanOrEqual(4000);
    expect(ui.defaultPrompt).toHaveLength(3);
    for (const p of ui.defaultPrompt) expect(p.length).toBeLessThanOrEqual(128);
    expect(new Set(ui.defaultPrompt).size).toBe(3);
    expect(plugin.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(plugin.name.length).toBeLessThanOrEqual(64);
  });

  it("fits the Claude listing limits with the same text", () => {
    expect(ui.displayName).toBe("BankJar");
    expect(ui.longDescription.length).toBeLessThanOrEqual(2000);
    const oneLiner = doc.match(/\*\*One-liner\*\*[^\n]*\n\n```\n([^\n]+)\n```/)?.[1] ?? "";
    expect(oneLiner.length).toBeGreaterThan(40);
    expect(oneLiner.length).toBeLessThanOrEqual(200);
  });

  it("follows the naming and wording rules", () => {
    for (const field of [ui.displayName, ui.shortDescription, ui.longDescription]) {
      expect(field).not.toMatch(/\b(MCP|plugin)\b/i);
      expect(field).not.toMatch(/\b(best|cheapest|number one|#1|free|discount|promotion|trial|subscription)\b/i);
    }
    expect(ui.longDescription).toContain("not financial advice");
  });

  it("has the four listing URLs, all HTTPS on the site and all served by a page", () => {
    const pages = { websiteURL: "", supportURL: "/support", privacyPolicyURL: "/privacy", termsOfServiceURL: "/terms" } as const;
    for (const [key, route] of Object.entries(pages)) {
      expect(ui[key], key).toBe(`https://bankjar.fabriquefutur.com${route}`);
      if (route) expect(fs.existsSync(path.join(process.cwd(), "app", route.slice(1), "page.tsx")), route).toBe(true);
    }
  });

  it("points at the live MCP server and keeps credentials out of the package", () => {
    const mcp = JSON.parse(read("directory", "openai-plugin", ".mcp.json"));
    expect(Object.keys(mcp.mcpServers)).toEqual(["bankjar"]);
    expect(mcp.mcpServers.bankjar).toEqual({ url: "https://bankjar.fabriquefutur.com/mcp" });
    const pkg = read("directory", "openai-plugin", ".codex-plugin", "plugin.json") + read("directory", "openai-plugin", ".mcp.json");
    expect(pkg).not.toMatch(/test_credentials|reviewer_instructions|clientSecret|api[_-]?key|bearer|password/i);
  });

  it("has exactly five positive and three negative test cases, each over the real tools", () => {
    const registered = [...read("src/server/mcp.ts").matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    const { positive, negative } = review.test_cases;
    expect(positive).toHaveLength(5);
    expect(negative).toHaveLength(3);
    for (const c of positive) {
      expect(c.description && c.prompt && c.expected_behavior).toBeTruthy();
      for (const tool of c.tools_triggered.split(",").map((t: string) => t.trim())) expect(registered, `${c.prompt} -> ${tool}`).toContain(tool);
    }
    for (const c of negative) expect(c.description && c.prompt).toBeTruthy();
    // Every tool is exercised by at least one positive case.
    const used = new Set(positive.flatMap((c: { tools_triggered: string }) => c.tools_triggered.split(",").map((t) => t.trim())));
    expect([...used].sort()).toEqual([...registered].sort());
  });

  it("is pasted into docs/DIRECTORY.md unchanged", () => {
    expect(doc).toContain(ui.longDescription);
    for (const p of ui.defaultPrompt) expect(doc).toContain(p);
    for (const c of [...review.test_cases.positive, ...review.test_cases.negative]) expect(doc).toContain(c.prompt);
  });

  it("has declared no commerce and no demo-recording address that does not exist", () => {
    expect(review.commerce).toBe(false);
    if ("demo_recording_url" in review) expect(review.demo_recording_url).toMatch(/^https:\/\//);
  });

  it("ships 512 and 1024 pixel PNG icons rendered from the site icon", () => {
    const size = (file: string) => {
      const b = fs.readFileSync(path.join(process.cwd(), "public", "brand", file));
      expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };
    expect(size("icon-512.png")).toEqual([512, 512]);
    expect(size("icon-1024.png")).toEqual([1024, 1024]);
    expect(read("public", "brand", "icon.svg")).toBe(read("app", "icon.svg"));
    for (const f of [ui.logo, ui.composerIcon]) {
      const packaged = fs.readFileSync(path.join(process.cwd(), "directory", "openai-plugin", f));
      expect(packaged.equals(fs.readFileSync(path.join(process.cwd(), "public", "brand", "icon-512.png"))), f).toBe(true);
    }
  });

  it("keeps the brand colours readable (2:1 on white and on #212121)", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    expect(ratio(ui.brandColor, "#ffffff")).toBeGreaterThanOrEqual(2);
    expect(ratio(ui.brandColorDark, "#212121")).toBeGreaterThanOrEqual(2);
  });
});

describe("the Claude plugin bundle", () => {
  const manifest = JSON.parse(read("plugin", ".claude-plugin", "plugin.json"));
  const marketplace = JSON.parse(read(".claude-plugin", "marketplace.json"));
  const registered = [...read("src/server/mcp.ts").matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);

  it("has a valid manifest with the fields the directory reads", () => {
    expect(manifest.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(manifest.name.length).toBeLessThanOrEqual(64);
    expect(manifest.license).toBe("Apache-2.0");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const k of ["description", "author", "repository", "documentationUrl", "supportUrl", "privacyPolicyUrl"]) expect(manifest[k], k).toBeTruthy();
    for (const k of ["documentationUrl", "supportUrl", "privacyPolicyUrl"]) expect(manifest[k]).toMatch(/^https:\/\/bankjar\.fabriquefutur\.com\//);
  });

  it("has a README of at least 40 words outside code blocks, and a licence", () => {
    const words = read("plugin", "README.md").replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(40);
    expect(read("plugin", "LICENSE")).toBe(read("LICENSE"));
  });

  it("declares exactly the live remote server over https and no secrets", () => {
    const mcp = JSON.parse(read("plugin", ".mcp.json"));
    expect(mcp.mcpServers).toEqual({ bankjar: { type: "http", url: "https://bankjar.fabriquefutur.com/mcp" } });
    const all = ["plugin/.claude-plugin/plugin.json", "plugin/.mcp.json", "plugin/skills/bank-offers/SKILL.md", "plugin/README.md"].map((f) => read(f)).join("\n");
    expect(all).not.toMatch(/clientSecret|api[_-]?key|bearer|password|token/i);
    expect(fs.existsSync(path.join(process.cwd(), "plugin", "hooks"))).toBe(false);
  });

  it("ships a skill whose tools all exist", () => {
    const skill = read("plugin", "skills", "bank-offers", "SKILL.md");
    const fm = skill.match(/^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/);
    expect(fm, "front matter").toBeTruthy();
    expect(fm![1]).toBe("bank-offers");
    expect(fm![2], "a plain YAML scalar must not contain ': '").not.toContain(": ");
    const named = [...skill.matchAll(/`([a-z]+_[a-z_]+)`/g)].map((m) => m[1]!).filter((t) => !t.endsWith("_on") && !t.startsWith("source"));
    for (const t of new Set(named)) expect(registered, t).toContain(t);
    for (const t of registered) expect(skill, t).toContain(`\`${t}\``);
  });

  it("is listed by the marketplace file at the folder the plugin lives in", () => {
    expect(marketplace.plugins).toHaveLength(1);
    const entry = marketplace.plugins[0];
    expect(entry.name).toBe(manifest.name);
    expect(fs.existsSync(path.join(process.cwd(), entry.source, ".claude-plugin", "plugin.json"))).toBe(true);
  });

  it("is written up in docs/DIRECTORY.md", () => {
    const doc = read("docs", "DIRECTORY.md");
    expect(doc).toContain("/plugin install bankjar --marketplace zaitsew/bankjar");
    expect(doc).toContain(manifest.description);
  });
});

describe("the Gemini Connected Apps pack", () => {
  it("has a square SVG logo of 500 pixels or more", () => {
    const svg = read("public", "brand", "logo.svg");
    const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/)!.map(Number);
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(500);
    const root = svg.match(/<svg[^>]*>/)![0];
    expect(Number(root.match(/ width="(\d+)"/)![1])).toBeGreaterThanOrEqual(500);
    expect(Number(root.match(/ height="(\d+)"/)![1])).toBe(Number(root.match(/ width="(\d+)"/)![1]));
    expect(svg).toMatch(/<rect width="32" height="32" fill="#0b0b0c"\/>/); // full-bleed background: no rx, no transparent corners
  });

  it("serves a data-deletion page that says there is no account and how to ask", () => {
    const t = text(html(DataDeletionPage));
    expect(t).toContain("no accounts");
    expect(t).toContain("Ask for deletion");
    expect(t).toContain("within one month");
    expect(t).toContain(`${CACHE_TTL_MS / 3_600_000} hours`);
  });

  it("links the deletion page from the privacy policy and the sitemap", () => {
    expect(html(PrivacyPage)).toContain('href="/data-deletion"');
    expect(sitemap().map((e) => e.url)).toContain(`${SITE}/data-deletion`);
  });

  it("is documented in docs/DIRECTORY.md", () => {
    const doc = read("docs", "DIRECTORY.md");
    expect(doc).toContain("Gemini Connected Apps");
    expect(doc).toContain("public/brand/logo.svg");
    expect(doc).toContain("https://bankjar.fabriquefutur.com/data-deletion");
  });
});
