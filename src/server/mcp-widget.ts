/**
 * The offer-cards widget: an MCP App (SEP-1865, https://modelcontextprotocol.io/extensions/apps)
 * that Claude and ChatGPT render inside the conversation for search_offers and compare_offers.
 *
 * One self-contained HTML string with inline CSS and JS: no bundle, no CDN, no third-party
 * iframe, so the resource's CSP asks the host for nothing. The page speaks the small slice of the
 * MCP Apps bridge it needs (JSON-RPC over postMessage): ui/initialize, ui/notifications/tool-result,
 * host-context-changed, size-changed and ui/open-link. It does not use @modelcontextprotocol/ext-apps:
 * the 2.x line needs the MCP SDK 2.x packages, and the 1.x line is only a browser client we do not need.
 *
 * Rules the widget keeps (docs/DESIGN.md, CLAUDE.md): every number comes from structuredContent, the
 * disclaimer is always visible, stale offers are badged, and every card links to the bank's own page.
 */

/** Part of the cache key in some hosts: change it with any breaking edit to the HTML below. */
export const OFFER_WIDGET_URI = "ui://bankjar/offer-cards-v1.html";

/** MCP Apps resource type (RESOURCE_MIME_TYPE in @modelcontextprotocol/ext-apps). */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

/** The wire protocol version this widget announces in ui/initialize. */
export const MCP_APPS_PROTOCOL_VERSION = "2026-01-26";

/**
 * Nothing is loaded from the network and nothing is fetched, so every list is empty. Hosts apply a
 * default-deny policy; declaring the empty lists states that on purpose and fails review loudly if
 * someone later adds a remote asset without listing it here.
 */
export const OFFER_WIDGET_CSP = {
  connectDomains: [] as string[],
  resourceDomains: [] as string[],
  frameDomains: [] as string[],
  baseUriDomains: [] as string[],
};

/** Tool `_meta` for the two tools that render the widget (standard key, flat legacy key, ChatGPT alias). */
export function offerWidgetToolMeta(invoking: string, invoked: string): Record<string, unknown> {
  return {
    ui: { resourceUri: OFFER_WIDGET_URI },
    "ui/resourceUri": OFFER_WIDGET_URI,
    "openai/outputTemplate": OFFER_WIDGET_URI,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

/**
 * The `_meta` on the resources/read content item. `prefersBorder: false` lets the card list sit in
 * the conversation like text. `openai/widgetDomain` is ChatGPT's own alias for the sandbox origin
 * (it wants an https origin); it is deliberately not `ui.domain`, because Claude validates that field
 * against a sha256 hash of the connector URL and refuses to render on a mismatch.
 */
export function offerWidgetResourceMeta(origin: string): Record<string, unknown> {
  return {
    ui: { prefersBorder: false, csp: OFFER_WIDGET_CSP },
    "openai/widgetPrefersBorder": false,
    "openai/widgetDomain": origin,
  };
}

const CSS = String.raw`
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: transparent; }
body {
  --bj-text: var(--color-text-primary, light-dark(#141413, #faf9f5));
  --bj-text-2: var(--color-text-secondary, light-dark(#3d3d3a, #c2c0b6));
  --bj-muted: var(--color-text-tertiary, light-dark(#5c5b56, #a8a69d));
  --bj-card: var(--color-background-secondary, light-dark(#f5f4ed, #262624));
  --bj-line: var(--color-border-secondary, light-dark(rgba(31, 30, 29, .3), rgba(222, 220, 209, .3)));
  --bj-line-soft: var(--color-border-tertiary, light-dark(rgba(31, 30, 29, .15), rgba(222, 220, 209, .15)));
  --bj-good: var(--color-text-success, light-dark(#265b19, #7ab948));
  --bj-good-bg: var(--color-background-success, light-dark(#e9f1dc, #1b4614));
  --bj-warn: var(--color-text-warning, light-dark(#5a4815, #d1a041));
  --bj-warn-bg: var(--color-background-warning, light-dark(#f6eedf, #483a0f));
  --bj-bad: var(--color-text-danger, light-dark(#7f2c28, #ee8884));
  --bj-bad-bg: var(--color-background-danger, light-dark(#f7ecec, #602a28));
  --bj-btn: var(--color-background-inverse, light-dark(#141413, #faf9f5));
  --bj-btn-text: var(--color-text-inverse, light-dark(#ffffff, #141413));
  --bj-ring: var(--color-ring-info, light-dark(rgba(50, 102, 173, .5), rgba(128, 170, 221, .5)));
  --bj-r: var(--border-radius-lg, 10px);
  font-family: var(--font-sans, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: var(--font-text-sm-size, 14px);
  line-height: 1.4;
  color: var(--bj-text);
}
#app { padding: 12px; padding-top: calc(12px + var(--bj-safe-top, 0px)); padding-bottom: calc(12px + var(--bj-safe-bottom, 0px)); padding-left: calc(12px + var(--bj-safe-left, 0px)); padding-right: calc(12px + var(--bj-safe-right, 0px)); }
h1 { margin: 0; font-size: var(--font-heading-md-size, 16px); font-weight: 600; line-height: 1.3; }
.sub { margin: 2px 0 0; color: var(--bj-text-2); }
.hint { color: var(--bj-muted); font-size: var(--font-text-xs-size, 12px); }
ul.list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 10px; }
.card { background: var(--bj-card); border: var(--border-width-regular, .5px) solid var(--bj-line); border-radius: var(--bj-r); padding: 14px; display: grid; gap: 8px; }
.card.off .value .n { color: var(--bj-muted); }
.top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.who { display: flex; gap: 10px; min-width: 0; flex: 1 1 220px; }
.rank { flex: none; width: 26px; height: 26px; border-radius: 50%; border: var(--border-width-regular, .5px) solid var(--bj-line); display: grid; place-items: center; font-weight: 600; font-size: 12px; color: var(--bj-text-2); }
.bank { font-weight: 600; font-size: var(--font-text-md-size, 16px); line-height: 1.25; overflow-wrap: anywhere; }
.product { color: var(--bj-text-2); overflow-wrap: anywhere; }
.value { text-align: right; flex: 0 0 auto; margin-left: auto; }
.value .n { font-size: var(--font-heading-xl-size, 24px); font-weight: 700; line-height: 1.1; color: var(--bj-good); font-variant-numeric: tabular-nums; }
.value .n.neg { color: var(--bj-bad); }
.value .l { color: var(--bj-muted); font-size: var(--font-text-xs-size, 12px); }
.headline { margin: 0; color: var(--bj-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.chip { border: var(--border-width-regular, .5px) solid var(--bj-line); border-radius: 999px; padding: 2px 9px; font-size: var(--font-text-xs-size, 12px); color: var(--bj-text-2); }
.chip.warn { background: var(--bj-warn-bg); color: var(--bj-warn); border-color: transparent; }
.chip.bad { background: var(--bj-bad-bg); color: var(--bj-bad); border-color: transparent; }
.chip.good { background: var(--bj-good-bg); color: var(--bj-good); border-color: transparent; }
.req { margin: 0; color: var(--bj-text-2); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.flag { margin: 0; padding: 5px 10px; border-radius: 8px; background: var(--bj-warn-bg); color: var(--bj-warn); font-size: var(--font-text-xs-size, 12px); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.note { margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--bj-bad-bg); color: var(--bj-bad); overflow-wrap: anywhere; }
.bottom { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; justify-content: space-between; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: var(--bj-muted); font-size: var(--font-text-xs-size, 12px); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: var(--border-radius-md, 8px); border: 0; background: var(--bj-btn); color: var(--bj-btn-text); font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
.btn.ghost { background: transparent; color: var(--bj-text); border: var(--border-width-regular, .5px) solid var(--bj-line); }
.btn:focus-visible { outline: 3px solid var(--bj-ring); outline-offset: 2px; }
.more { margin-top: 10px; display: flex; justify-content: center; }
.foot { margin-top: 12px; padding-top: 10px; border-top: var(--border-width-regular, .5px) solid var(--bj-line-soft); color: var(--bj-text-2); font-size: var(--font-text-xs-size, 12px); display: grid; gap: 2px; }
.foot strong { color: var(--bj-text); }
.skel { height: 96px; border-radius: var(--bj-r); background: var(--bj-card); opacity: .6; animation: pulse 1.4s ease-in-out infinite; margin-top: 10px; }
@keyframes pulse { 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
@media (max-width: 440px) {
  .card { padding: 12px; }
  .value { text-align: left; flex: 1 1 100%; display: flex; align-items: baseline; gap: 8px; }
  .card.num .value { margin-left: 36px; }
  .btn { width: 100%; }
}
`;

const JS = String.raw`
(function () {
  "use strict";
  var PROTOCOL = "__PROTOCOL__";
  var DISCLAIMER = "Not financial advice. Terms change; check source_url before signing.";
  var VISIBLE = 3;
  var GOALS = { salary: "salary bonus", savings: "savings", account: "free account", deposit: "term deposit", welcome: "welcome bonus" };
  var app = document.getElementById("app");
  var nextId = 1;
  var pending = {};
  var state = { data: null, error: null, expanded: false };
  var hosted = window.parent !== window;

  function send(msg) {
    if (!hosted) return;
    msg.jsonrpc = "2.0";
    window.parent.postMessage(msg, "*");
  }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      send({ id: id, method: method, params: params });
    });
  }

  // ---- host context: theme, style variables, safe areas ----
  function applyContext(ctx) {
    if (!ctx) return;
    var root = document.documentElement;
    if (ctx.theme === "light" || ctx.theme === "dark") {
      root.setAttribute("data-theme", ctx.theme);
      root.style.colorScheme = ctx.theme;
    }
    var vars = ctx.styles && ctx.styles.variables;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        if (/^--[a-z0-9-]+$/.test(k) && typeof vars[k] === "string") root.style.setProperty(k, vars[k]);
      });
    }
    var s = ctx.safeAreaInsets;
    if (s) {
      ["top", "right", "bottom", "left"].forEach(function (side) {
        if (typeof s[side] === "number") root.style.setProperty("--bj-safe-" + side, s[side] + "px");
      });
    }
    if (ctx.locale) root.lang = ctx.locale;
  }

  // ---- size: tell the host how tall the card list is ----
  var lastW = 0, lastH = 0, sizeQueued = false;
  function reportSize() {
    if (sizeQueued) return;
    sizeQueued = true;
    requestAnimationFrame(function () {
      sizeQueued = false;
      var el = document.documentElement;
      var prev = el.style.height;
      el.style.height = "max-content";
      var h = Math.ceil(el.getBoundingClientRect().height);
      el.style.height = prev;
      var w = Math.ceil(window.innerWidth);
      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        send({ method: "ui/notifications/size-changed", params: { width: w, height: h } });
      }
    });
  }
  if (typeof ResizeObserver === "function") {
    var ro = new ResizeObserver(reportSize);
    ro.observe(document.documentElement);
    ro.observe(document.body);
  }

  // ---- links: only https, only through the host ----
  function safeHttps(u) {
    try {
      var p = new URL(String(u));
      return p.protocol === "https:" ? p.href : null;
    } catch (e) {
      return null;
    }
  }
  // Returns true when a host API took the link. ChatGPT: window.openai.openExternal. MCP Apps (Claude): ui/open-link.
  function openLink(url) {
    if (window.openai && typeof window.openai.openExternal === "function") {
      try {
        var r = window.openai.openExternal({ href: url });
        if (r && typeof r.catch === "function") r.catch(function () {});
        return true;
      } catch (e) { /* fall through to the bridge */ }
    }
    if (hosted) {
      request("ui/open-link", { url: url }).catch(function () {});
      return true;
    }
    return false;
  }

  // ---- formatting ----
  var money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  function eur(n) {
    if (typeof n !== "number" || !isFinite(n)) return "n/a";
    return (n < 0 ? "−" : "") + money.format(Math.abs(n));
  }
  function months(m) {
    if (m === null || m === undefined) return "Commitment unknown";
    if (m === 0) return "No commitment";
    return m + (m === 1 ? " month" : " months") + " commitment";
  }
  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function chip(list, text, kind) {
    list.appendChild(el("li", "chip" + (kind ? " " + kind : ""), text));
  }

  // ---- one offer card ----
  function card(o, index, opts) {
    var score = o.score || {};
    var reasons = o.not_eligible_reasons || [];
    var li = el("li", "card" + (reasons.length ? " off" : "") + (opts.numbered ? " num" : ""));

    var top = el("div", "top");
    var who = el("div", "who");
    if (opts.numbered) who.appendChild(el("span", "rank", index + 1));
    var names = el("div");
    names.appendChild(el("div", "bank", o.bank));
    names.appendChild(el("div", "product", o.product_name));
    who.appendChild(names);
    top.appendChild(who);
    var val = el("div", "value");
    val.appendChild(el("div", "n" + (score.net_value_eur < 0 ? " neg" : ""), eur(score.net_value_eur)));
    val.appendChild(el("div", "l", reasons.length ? "first-year net value, if eligible" : "first-year net value"));
    top.appendChild(val);
    li.appendChild(top);

    if (o.headline) li.appendChild(el("p", "headline", o.headline));

    var chips = el("ul", "chips");
    chip(chips, months(o.commitment_months));
    var r = o.requirements || {};
    if (typeof r.min_monthly_income_eur === "number") chip(chips, "Income ≥ " + eur(r.min_monthly_income_eur) + "/month");
    if (r.new_customer_only === true) chip(chips, "New customers only");
    if (o.eligibility && o.eligibility.residents_only === true) chip(chips, "Residents only");
    if (o.fees && typeof o.fees.monthly_eur === "number" && o.fees.monthly_eur > 0) chip(chips, eur(o.fees.monthly_eur) + "/month fee");
    if (typeof o.rate_tae === "number" && o.rate_tae > 0) chip(chips, o.rate_tae + "% TAE");
    if (o.valid_until) chip(chips, "Valid until " + o.valid_until);
    if (opts.best) chip(chips, "Highest value here", "good");
    if (o.stale) chip(chips, "Terms may have changed", "warn");
    li.appendChild(chips);

    var others = r.other || [];
    if (others.length) {
      var rq = el("p", "req", others[0]);
      if (others.length > 1) rq.appendChild(el("span", "hint", " +" + (others.length - 1) + " more at the bank"));
      li.appendChild(rq);
    }

    var flags = (score.flags || []).slice();
    if (o.penalty && !flags.some(function (f) { return f.indexOf(o.penalty) !== -1; })) flags.push("penalty: " + o.penalty);
    flags.forEach(function (f) { f = f.charAt(0).toUpperCase() + f.slice(1); var fp = el("p", "flag", f); fp.title = f; li.appendChild(fp); });

    if (reasons.length) li.appendChild(el("p", "note", "Not available to this profile: " + reasons.join("; ") + "."));

    var bottom = el("div", "bottom");
    var meta = el("div", "meta");
    meta.appendChild(el("span", null, "Verified " + o.verified_on));
    var url = safeHttps(o.source_url);
    if (url && host(url)) meta.appendChild(el("span", null, "· " + host(url)));
    bottom.appendChild(meta);
    if (url) {
      var a = el("a", "btn", "Check terms at the bank ↗");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "Check terms at the bank: " + o.bank + " " + o.product_name + " (opens " + host(url) + ")");
      a.addEventListener("click", function (ev) {
        if (openLink(url)) ev.preventDefault();
      });
      bottom.appendChild(a);
    }
    li.appendChild(bottom);
    return li;
  }

  // ---- whole view ----
  function render() {
    app.textContent = "";
    var d = state.data;
    if (state.error) {
      app.appendChild(el("h1", null, "BankJar"));
      app.appendChild(el("p", "sub", state.error));
      app.appendChild(footer(null));
      reportSize();
      return;
    }
    if (!d) {
      app.appendChild(el("h1", null, "Loading offers…"));
      app.appendChild(el("div", "skel"));
      app.appendChild(el("div", "skel"));
      reportSize();
      return;
    }
    var isCompare = Array.isArray(d.missing);
    var offers = Array.isArray(d.offers) ? d.offers : [];

    if (isCompare) {
      app.appendChild(el("h1", null, "Comparing " + offers.length + " offer" + (offers.length === 1 ? "" : "s")));
      app.appendChild(el("p", "sub", "Same profile for every row. Figures are estimates, in the order you asked."));
    } else {
      var goal = GOALS[d.goal] || d.goal || "offers";
      var total = typeof d.total_offers === "number" ? d.total_offers : offers.length;
      app.appendChild(el("h1", null, "Best offers for " + goal));
      var line = d.summary || "";
      if (total > offers.length) line += (line ? " " : "") + "Top " + offers.length + " of " + total + " ranked.";
      if (line) app.appendChild(el("p", "sub", line));
    }

    if (!offers.length) {
      app.appendChild(el("p", "sub", isCompare ? "None of these ids matched an offer." : "No offers match this profile."));
    }

    var best = -1;
    if (isCompare) {
      var eligible = offers.filter(function (o) { return !(o.not_eligible_reasons || []).length; });
      if (eligible.length > 1) {
        var top = eligible.reduce(function (m, o) { return o.score.net_value_eur > m.score.net_value_eur ? o : m; }, eligible[0]);
        var ties = eligible.filter(function (o) { return o.score.net_value_eur === top.score.net_value_eur; });
        if (ties.length === 1) best = offers.indexOf(top);
      }
    }

    var shown = state.expanded ? offers : offers.slice(0, VISIBLE);
    var list = el("ul", "list");
    shown.forEach(function (o, i) { list.appendChild(card(o, i, { numbered: !isCompare, best: i === best })); });
    app.appendChild(list);

    if (offers.length > VISIBLE) {
      var more = el("div", "more");
      var b = el("button", "btn ghost", state.expanded ? "Show top " + VISIBLE : "Show all " + offers.length);
      b.type = "button";
      b.setAttribute("aria-expanded", state.expanded ? "true" : "false");
      b.addEventListener("click", function () { state.expanded = !state.expanded; render(); });
      more.appendChild(b);
      app.appendChild(more);
    }

    if (isCompare && d.missing.length) app.appendChild(el("p", "hint", "Unknown ids: " + d.missing.join(", ") + "."));
    if (!isCompare && Array.isArray(d.excluded) && d.excluded.length) {
      app.appendChild(el("p", "hint", d.excluded.length + " more offer" + (d.excluded.length === 1 ? " is" : "s are") + " excluded for this profile; ask for the reasons."));
    }
    app.appendChild(footer(d));
    reportSize();
  }

  function footer(d) {
    var f = el("div", "foot");
    var p = el("div");
    p.appendChild(el("strong", null, "Not financial advice."));
    p.appendChild(document.createTextNode(" Terms change; check the bank's page before signing."));
    f.appendChild(p);
    var when = d && d.dataset && d.dataset.latest_verified_on;
    f.appendChild(el("div", null, "Estimates for the profile given, from BankJar open data" + (when ? " checked up to " + when : "") + ". Net of 19% withholding tax, gifts and fees."));
    return f;
  }

  // ---- tool results ----
  function fromResult(res) {
    if (!res) return;
    if (res.isError) {
      var t = (res.content || []).map(function (c) { return c && c.text; }).filter(Boolean).join(" ");
      state.error = t || "The tool returned an error.";
      state.data = null;
      render();
      return;
    }
    var sc = res.structuredContent;
    if (!sc && Array.isArray(res.content)) {
      for (var i = res.content.length - 1; i >= 0 && !sc; i--) {
        try { var j = JSON.parse(res.content[i].text); if (j && Array.isArray(j.offers)) sc = j; } catch (e) { /* not JSON */ }
      }
    }
    if (sc && Array.isArray(sc.offers)) {
      state.data = sc;
      state.error = null;
      state.expanded = false;
      render();
    }
  }

  // ---- bridge ----
  window.addEventListener("message", function (ev) {
    if (hosted && ev.source !== window.parent) return;
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (typeof m.method === "string") {
      if (m.method === "ui/notifications/tool-result") fromResult(m.params);
      else if (m.method === "ui/notifications/host-context-changed") applyContext(m.params);
      else if (m.id !== undefined) {
        if (m.method === "ui/resource-teardown" || m.method === "ping") send({ id: m.id, result: {} });
        else send({ id: m.id, error: { code: -32601, message: "Method not found: " + m.method } });
      }
      return;
    }
    var p = pending[m.id];
    if (!p) return;
    delete pending[m.id];
    if (m.error) p.reject(new Error(m.error.message || "error"));
    else p.resolve(m.result);
  });
  // ChatGPT also mirrors the tool output on window.openai.
  window.addEventListener("openai:set_globals", function (ev) {
    var g = ev && ev.detail && ev.detail.globals;
    if (g && g.toolOutput) fromResult({ structuredContent: g.toolOutput });
  });

  render();
  if (window.openai && window.openai.toolOutput) fromResult({ structuredContent: window.openai.toolOutput });
  if (hosted) {
    request("ui/initialize", { appInfo: { name: "bankjar-offer-cards", version: "1.0.0" }, appCapabilities: {}, protocolVersion: PROTOCOL })
      .then(function (r) {
        applyContext(r && r.hostContext);
        send({ method: "ui/notifications/initialized", params: {} });
        reportSize();
      })
      .catch(function () { /* render without host context */ });
  }
})();
`.replace("__PROTOCOL__", MCP_APPS_PROTOCOL_VERSION);

/** The whole page. `<meta name="color-scheme">` stops the opaque iframe backdrop flash in dark mode. */
export const OFFER_WIDGET_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>BankJar offers</title>
<style>${CSS}</style>
</head>
<body>
<div id="app" aria-live="polite"></div>
<script>${JS}</script>
</body>
</html>
`;
