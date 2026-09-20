import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(ROOT, "index.html");
const CHECK = process.argv.includes("--check");

const PAGES = [
  { id: "s00", short: "Helheten", file: "s00-helheten.md", status: "V4 · 8 dagar", tone: "decision" },
  { id: "s01", short: "Kartan", file: "s01-kartan.md", status: "Karta", tone: "reference" },
  { id: "s02", short: "Signalerna", file: "s02-spraket.md", status: "Kodkontrollerat", tone: "reference" },
  { id: "s03", short: "Eventträdet", file: "s03-motorn.md", status: "Arbetsförslag", tone: "proposal" },
  { id: "s04", short: "Säker presentation", file: "s04-openclaw.md", status: "Gräns", tone: "decision" },
  { id: "s05", short: "Ordlistan", file: "s05-ordlista.md", status: "Referens", tone: "reference" },
  { id: "s06", short: "8 dagar", file: "s06-plan.md", status: "Arbetsplan", tone: "proposal" },
];

const PAGE_LINKS = new Map(PAGES.map((page) => [page.file, `#${page.id}`]));
const WIKI = "https://gitlab.com/scout-gg/croupier/-/wikis/";
for (const file of ["README", "CANVAS", "DECISIONS", "RUNTIME-EVIDENCE"]) {
  PAGE_LINKS.set(`docs/${file}.md`, `${WIKI}animation-events/v4-8-days-mvp/${file}`);
}
const contentVersion = createHash("sha256").update(PAGES.map(page =>
  readFileSync(join(ROOT, page.file), "utf8").replaceAll("\r\n", "\n")
).join("\n")).digest("hex").slice(0, 12);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(rawHref) {
  const href = rawHref.trim();
  if (PAGE_LINKS.has(href)) return PAGE_LINKS.get(href);
  if (/^(https?:\/\/|mailto:|#)/i.test(href)) return href;
  if (/^[./a-z0-9_-]+(?:\.[a-z0-9]+)?(?:#[a-z0-9_-]+)?$/i.test(href)) return href;
  return "#";
}

function renderInline(source) {
  const tokens = [];
  const reserve = (html) => {
    const key = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return key;
  };

  let value = String(source);
  value = value.replace(/`([^`]+)`/g, (_, code) => reserve(`<code>${escapeHtml(code)}</code>`));
  value = value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
    const safe = safeHref(href);
    const external = /^https?:\/\//i.test(safe) ? ' target="_blank" rel="noreferrer"' : "";
    return reserve(`<a href="${escapeHtml(safe)}"${external}>${escapeHtml(label)}</a>`);
  });
  value = escapeHtml(value);
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  value = value.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  value = value.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
  return value;
}

function splitTableRow(line) {
  const text = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let escaped = false;
  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(lines, index) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return (
    /^```/.test(line) ||
    /^#{2,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^(?:-{3,}|\*{3,})\s*$/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    (line.includes("|") && isTableDivider(next))
  );
}

function renderBlocks(lines) {
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```\s*([^\s]*)\s*$/);
    if (fence) {
      const language = fence[1] || "text";
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(`<pre data-language="${escapeHtml(language)}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{3,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(?:-{3,}|\*{3,})\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(`<aside class="callout">${renderBlocks(quote)}</aside>`);
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const headers = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      const head = headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("");
      const body = rows
        .map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "")}</td>`).join("")}</tr>`)
        .join("");
      output.push(`<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        const item = [match[1]];
        index += 1;
        while (
          index < lines.length &&
          /^\s{2,}\S/.test(lines[index]) &&
          !/^\s*[-*+]\s+/.test(lines[index]) &&
          !/^\s*\d+\.\s+/.test(lines[index])
        ) {
          item.push(lines[index].trim());
          index += 1;
        }
        items.push(`<li>${renderInline(item.join(" "))}</li>`);
      }
      output.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        const item = [match[1]];
        index += 1;
        while (
          index < lines.length &&
          /^\s{2,}\S/.test(lines[index]) &&
          !/^\s*[-*+]\s+/.test(lines[index]) &&
          !/^\s*\d+\.\s+/.test(lines[index])
        ) {
          item.push(lines[index].trim());
          index += 1;
        }
        items.push(`<li>${renderInline(item.join(" "))}</li>`);
      }
      output.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return output.join("\n");
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "avsnitt";
}

function plainText(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

function parsePage(page) {
  const markdown = readFileSync(join(ROOT, page.file), "utf8").replaceAll("\r\n", "\n");
  const lines = markdown.split("\n");
  const titleLine = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleLine < 0) throw new Error(`${page.file} saknar H1`);
  const title = lines[titleLine].replace(/^#\s+/, "").trim();
  const introLines = [];
  const sections = [];
  let current = null;

  for (const line of lines.slice(titleLine + 1)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { title: plainText(heading[1]), sourceTitle: heading[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }

  if (sections.length === 0) {
    sections.push({ title: "Översikt", sourceTitle: "Översikt", lines: introLines.splice(0) });
  }

  const used = new Map();
  for (const section of sections) {
    const base = slugify(section.title);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    section.id = count ? `${base}-${count + 1}` : base;
    section.html = renderBlocks(section.lines);
  }

  return {
    ...page,
    title,
    introHtml: renderBlocks(introLines),
    sections,
  };
}

const pages = PAGES.map(parsePage);
const totalSections = pages.reduce((sum, page) => sum + page.sections.length, 0);

function renderPage(page, pageIndex) {
  const tabs = page.sections
    .map((section, sectionIndex) => `<button class="section-tab${sectionIndex === 0 ? " is-active" : ""}" type="button" role="tab" aria-selected="${sectionIndex === 0}" data-section="${escapeHtml(section.id)}">${escapeHtml(section.title)}</button>`)
    .join("");
  const sections = page.sections
    .map((section, sectionIndex) => `<section class="doc-section${sectionIndex === 0 ? " is-active" : ""}" id="${page.id}-${escapeHtml(section.id)}" data-section="${escapeHtml(section.id)}" role="tabpanel">
      <h2>${renderInline(section.sourceTitle)}</h2>
      ${section.html}
    </section>`)
    .join("\n");

  return `<article class="page${pageIndex === 0 ? " is-active" : ""}" id="page-${page.id}" data-page="${page.id}">
    <header class="page-header">
      <div class="eyebrow">${page.id} · ${escapeHtml(page.short)}</div>
      <div class="title-row">
        <h1>${renderInline(page.title)}</h1>
        <span class="status ${page.tone}">${escapeHtml(page.status)}</span>
      </div>
      <div class="intro">${page.introHtml}</div>
    </header>
    <div class="section-tabs" role="tablist" aria-label="Avsnitt på ${escapeHtml(page.short)}"${page.sections.length === 1 ? " hidden" : ""}>${tabs}</div>
    <div class="sections">${sections}</div>
  </article>`;
}

const navigation = pages
  .map((page, index) => `<a class="page-link${index === 0 ? " is-active" : ""}" href="#${page.id}" data-page="${page.id}" aria-current="${index === 0 ? "page" : "false"}"><span>${page.id}</span>${escapeHtml(page.short)}</a>`)
  .join("");

const css = `
:root {
  color-scheme: light dark;
  --bg: #f4f3ef;
  --surface: #ffffff;
  --surface-muted: #ebe9e3;
  --text: #17211c;
  --muted: #5d6962;
  --line: #d4d7d2;
  --accent: #135f46;
  --accent-soft: #d9ebe3;
  --proposal: #8a5a12;
  --proposal-soft: #f5e8cf;
  --reference: #315b7d;
  --reference-soft: #dce9f2;
  --code: #18241e;
  --code-text: #e5eee9;
  --max: 1180px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111714;
    --surface: #18201c;
    --surface-muted: #202a25;
    --text: #e7ede9;
    --muted: #aebbb3;
    --line: #34433b;
    --accent: #72c7a4;
    --accent-soft: #1f4838;
    --proposal: #e0b36b;
    --proposal-soft: #49391f;
    --reference: #8db8d7;
    --reference-soft: #233c4d;
    --code: #0b100d;
    --code-text: #dce8e1;
  }
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.58 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
a { color: var(--accent); text-underline-offset: 3px; }
button, input { font: inherit; }

.site-header {
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.header-inner {
  max-width: var(--max);
  margin: 0 auto;
  padding: 28px 24px 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 370px);
  gap: 28px;
  align-items: end;
}
.kicker {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.site-title { margin: 0; font-size: clamp(25px, 4vw, 42px); line-height: 1.08; letter-spacing: -.03em; }
.site-lead { max-width: 720px; margin: 12px 0 0; color: var(--muted); font-size: 16px; }
.source-line { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 15px; }
.source-chip { padding: 5px 9px; border: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.source-chip strong { color: var(--text); }
.overview-flow { max-width: var(--max); margin: 0 auto; padding: 0 24px 22px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; list-style: none; }
.overview-flow li { margin: 0; padding: 14px 16px; background: var(--bg); border: 1px solid var(--line); border-top: 3px solid var(--accent); }
.overview-flow .step { display: block; color: var(--accent); font: 700 11px/1.2 ui-monospace, Consolas, monospace; letter-spacing: .07em; margin-bottom: 8px; }
.overview-flow strong { display: block; font-size: 15px; }
.overview-flow small { display: block; margin-top: 5px; color: var(--muted); font-size: 12px; }
.skip-link { position: absolute; top: -50px; left: 16px; padding: 8px 12px; background: var(--surface); z-index: 1; }
.skip-link:focus { top: 8px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.search-box label { display: block; margin-bottom: 7px; color: var(--muted); font-size: 12px; font-weight: 700; }
.search-row { display: flex; border: 1px solid var(--line); background: var(--bg); }
.search-row:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.search-row input { min-width: 0; flex: 1; border: 0; padding: 10px 12px; color: var(--text); background: transparent; outline: 0; }
.search-row button { border: 0; border-left: 1px solid var(--line); padding: 0 12px; color: var(--muted); background: transparent; cursor: pointer; }
.search-result { min-height: 20px; margin: 6px 0 0; color: var(--muted); font-size: 12px; }

.page-nav {
  max-width: var(--max);
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  gap: 6px;
  overflow-x: auto;
}
.page-link {
  flex: 0 0 auto;
  padding: 8px 11px;
  border: 1px solid transparent;
  color: var(--muted);
  text-decoration: none;
  white-space: nowrap;
}
.page-link span { margin-right: 6px; color: var(--accent); font-size: 11px; font-weight: 800; text-transform: uppercase; }
.page-link:hover { border-color: var(--line); color: var(--text); }
.page-link.is-active { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }

main { max-width: var(--max); margin: 0 auto; padding: 30px 24px 72px; }
.page { display: none; }
.page.is-active { display: block; }
.page-header { max-width: 930px; }
.eyebrow { margin-bottom: 6px; color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.title-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
h1 { margin: 0; font-size: 26px; line-height: 1.2; letter-spacing: -.02em; }
h2 { margin: 0 0 18px; font-size: 21px; line-height: 1.25; }
h3 { margin: 30px 0 10px; font-size: 17px; }
h4 { margin: 24px 0 8px; font-size: 15px; }
p { margin: 0 0 14px; }
.intro { margin-top: 13px; color: var(--muted); font-size: 16px; }
.intro .callout { color: var(--text); }
.status { padding: 4px 8px; border: 1px solid currentColor; font-size: 11px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
.status.decision { color: var(--accent); background: var(--accent-soft); }
.status.proposal { color: var(--proposal); background: var(--proposal-soft); }
.status.reference { color: var(--reference); background: var(--reference-soft); }

.section-tabs { display: flex; gap: 7px; margin: 28px 0 20px; padding-bottom: 10px; overflow-x: auto; border-bottom: 1px solid var(--line); }
.section-tabs[hidden] { display: none; }
.section-tabs[hidden] + .sections { margin-top: 24px; }
.section-tab { flex: 0 0 auto; border: 1px solid var(--line); padding: 7px 10px; color: var(--muted); background: var(--surface); cursor: pointer; }
.section-tab:hover { color: var(--text); border-color: var(--accent); }
.section-tab.is-active { color: var(--surface); border-color: var(--accent); background: var(--accent); }
.doc-section { display: none; max-width: 1040px; }
.doc-section.is-active { display: block; }
.doc-section > p, .doc-section > ul, .doc-section > ol, .doc-section > .callout { max-width: 880px; }
ul, ol { margin: 0 0 18px; padding-left: 23px; }
li { margin: 5px 0; }
hr { margin: 32px 0; border: 0; border-top: 1px solid var(--line); }
.callout { margin: 16px 0 20px; padding: 12px 15px; border-left: 4px solid var(--accent); background: var(--accent-soft); }
.callout p:last-child { margin-bottom: 0; }
code { padding: 1px 5px; background: var(--surface-muted); font: .9em/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
pre { position: relative; margin: 16px 0 22px; padding: 30px 17px 16px; overflow-x: auto; border: 1px solid var(--line); background: var(--code); color: var(--code-text); }
pre::before { content: attr(data-language); position: absolute; top: 7px; left: 17px; color: #9eb0a6; font: 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; }
pre code { padding: 0; background: transparent; color: inherit; }
.table-scroll { margin: 14px 0 24px; overflow-x: auto; border: 1px solid var(--line); }
table { width: 100%; border-collapse: collapse; background: var(--surface); font-size: 13px; }
th, td { padding: 10px 11px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { color: var(--muted); background: var(--surface-muted); font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--accent-soft); }

.searching .doc-section { display: none; }
.searching .doc-section.search-match { display: block; margin-bottom: 34px; }
.searching .section-tabs { display: none; }
.searching .doc-section.search-match h2::after { content: " · träff"; color: var(--accent); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }

.site-footer { border-top: 1px solid var(--line); color: var(--muted); background: var(--surface); }
.footer-inner { max-width: var(--max); margin: 0 auto; padding: 18px 24px 28px; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; font-size: 12px; }

@media (max-width: 760px) {
  .header-inner { grid-template-columns: 1fr; padding-top: 22px; }
  .site-title { font-size: 28px; }
  main { padding-top: 24px; }
  th, td { min-width: 150px; }
  .overview-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .overview-flow li { padding: 11px 12px; }
}

@media print {
  .search-box, .page-nav, .section-tabs { display: none !important; }
  body { background: #fff; color: #000; }
  .site-header, .site-footer { background: #fff; }
  .page, .doc-section { display: block !important; break-inside: avoid; }
  .page { margin-bottom: 48px; }
  a { color: #000; }
}
`;

const browserScript = `
(function () {
  var pageLinks = Array.prototype.slice.call(document.querySelectorAll(".page-link"));
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page"));
  var search = document.getElementById("search");
  var clear = document.getElementById("clear-search");
  var result = document.getElementById("search-result");

  function currentPage() {
    return document.querySelector(".page.is-active");
  }

  function showSection(page, sectionId) {
    var sections = Array.prototype.slice.call(page.querySelectorAll(".doc-section"));
    var tabs = Array.prototype.slice.call(page.querySelectorAll(".section-tab"));
    var chosen = sections.find(function (section) { return section.dataset.section === sectionId; }) || sections[0];
    sections.forEach(function (section) { section.classList.toggle("is-active", section === chosen); });
    tabs.forEach(function (tab) {
      var active = chosen && tab.dataset.section === chosen.dataset.section;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
  }

  function showFromHash() {
    if (location.hash === "#content") { document.getElementById("content").focus(); return; }
    var raw = (location.hash || "#s00").slice(1);
    var parts = raw.split("/");
    var pageId = parts[0];
    var page = pages.find(function (candidate) { return candidate.dataset.page === pageId; }) || pages[0];
    pages.forEach(function (candidate) { candidate.classList.toggle("is-active", candidate === page); });
    pageLinks.forEach(function (link) {
      var active = link.dataset.page === page.dataset.page;
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    });
    search.value = "";
    applySearch();
    showSection(page, parts[1]);
    document.title = "Croupier · V4 · " + page.querySelector(".eyebrow").textContent;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function applySearch() {
    var page = currentPage();
    if (!page) return;
    var query = search.value.trim().toLocaleLowerCase("sv");
    var sections = Array.prototype.slice.call(page.querySelectorAll(".doc-section"));
    page.classList.toggle("searching", Boolean(query));
    var matches = 0;
    sections.forEach(function (section) {
      var matched = Boolean(query) && section.textContent.toLocaleLowerCase("sv").includes(query);
      section.classList.toggle("search-match", matched);
      if (matched) matches += 1;
    });
    result.textContent = query ? (matches + (matches === 1 ? " avsnitt matchar" : " avsnitt matchar")) : "Söker på den öppna sidan";
  }

  pages.forEach(function (page) {
    page.querySelectorAll(".section-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        showSection(page, tab.dataset.section);
        history.replaceState(null, "", "#" + page.dataset.page + "/" + tab.dataset.section);
      });
    });
  });
  search.addEventListener("input", applySearch);
  clear.addEventListener("click", function () { search.value = ""; applySearch(); search.focus(); });
  window.addEventListener("hashchange", showFromHash);
  showFromHash();
}());
`;

const documentHtml = `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Croupiers presentationsplan V4: åtta dagar, verkliga signaler, tydliga källor och verifierad uppspelning.">
  <title>Croupier · Presentationsplan V4</title>
  <style>${css}</style>
</head>
<body data-content-version="${contentVersion}">
  <a class="skip-link" href="#content">Till innehållet</a>
  <header class="site-header">
    <div class="header-inner">
      <div>
        <p class="kicker">Croupier · Presentationsplan · V4</p>
        <h1 class="site-title">Från verklig signal<br>till verifierad uppspelning.</h1>
        <p class="site-lead">Åtta arbetsdagar. En gemensam karta över produkten, labbet och nästa steg. Spelmotorn äger utfallet; presentationen visar det.</p>
        <div class="source-line">
          <a class="source-chip" href="https://gitlab.com/scout-gg/croupier/-/tree/jakeminator123/work">Motor och kod · GitLab</a>
          <a class="source-chip" href="${WIKI}animation-events/v4-8-days-mvp/README">V4 i gemensamma wikin</a>
          <a class="source-chip" href="${WIKI}agent-inbox">Kevin · Jakob · Emil: inbox och agenter</a>
          <a class="source-chip" href="https://github.com/Jakeminator123/animation-events-v1">Canvasens källkod · GitHub</a>
          <span class="source-chip"><strong>Plan:</strong> 8 dagar · 7 korta kapitel</span>
        </div>
      </div>
      <div class="search-box">
        <label for="search">Sök på den öppna sidan</label>
        <div class="search-row"><input id="search" type="search" autocomplete="off" placeholder="Till exempel: eventström, ljud, fallback"><button id="clear-search" type="button">Rensa</button></div>
        <p class="search-result" id="search-result" role="status">Söker på den öppna sidan</p>
      </div>
    </div>
    <ol class="overview-flow" aria-label="Från händelse till uppspelning">
      <li><span class="step">01 · SIGNAL</span><strong>Vad hände?</strong><small>Spelfakta, text och kontext</small></li>
      <li><span class="step">02 · BEHOV</span><strong>Vad ska visas?</strong><small>En tydlig presentationsuppgift</small></li>
      <li><span class="step">03 · URVAL</span><strong>Vilket material passar?</strong><small>Kompatibelt material och fallback</small></li>
      <li><span class="step">04 · KVITTO</span><strong>Vad spelades faktiskt?</strong><small>Uppspelning och visuell kontroll</small></li>
    </ol>
    <nav class="page-nav" aria-label="V4-sidor">${navigation}</nav>
  </header>
  <main id="content" tabindex="-1">${pages.map(renderPage).join("\n")}</main>
  <footer class="site-footer"><div class="footer-inner"><span>V4 · innehåll ${contentVersion} · <a href="archive/v3/">V3-historik</a> · <a href="archive/v2/">V2-historik</a> · <a href="${WIKI}animation-events/v4-8-days-mvp/DECISIONS">Beslutslogg</a> · <a href="${WIKI}animation-events/v4-8-days-mvp/RUNTIME-EVIDENCE">Tekniskt kvitto</a></span><span>Kodkontrollerat · labbprov · förslag · live ej verifierat</span></div></footer>
  <script>${browserScript}</script>
</body>
</html>
`;

if (CHECK) {
  let current = "";
  try {
    current = readFileSync(OUTPUT, "utf8").replaceAll("\r\n", "\n");
  } catch {
    // A missing output is reported as stale below.
  }
  if (current !== documentHtml) {
    console.error("index.html är inaktuell. Kör: node build-static.mjs");
    process.exitCode = 1;
  } else {
    console.log(`index.html är reproducerbar (${PAGES.length} sidor, ${totalSections} avsnitt).`);
  }
} else {
  writeFileSync(OUTPUT, documentHtml, "utf8");
  console.log(`Skrev index.html (${PAGES.length} sidor, ${totalSections} avsnitt).`);
}
