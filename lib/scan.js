/**
 * Scans a Shopify OS 2.0 theme and returns every reusable piece as catalog items:
 * sections, theme blocks, snippets, JS modules, SCSS partials + global settings.
 *
 * Reads: schema JSON in sections/blocks, LiquidDoc {% doc %}, @capability headers
 * (FoxTheme convention) in src/js + src/scss, templates/*.json and section groups.
 * Folders a theme lacks (e.g. no src/) are simply skipped.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CATEGORIES, UNCATEGORIZED } = require("./categories");

let ROOT = "";
let schemaLocale = {};

// ─── helpers ────────────────────────────────────────────────────────────────

function read(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

// Short content fingerprint — lets the next run tell "file edited" apart from "unchanged".
function hash(content) {
  return crypto.createHash("sha1").update(content.replace(/\r\n/g, "\n")).digest("hex").slice(0, 12);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

// Minimal glob for the two shapes used here: "dir/*.ext" and "dir/**/*.ext".
function files(pattern) {
  const m = pattern.match(/^(.*?)\/(\*\*\/)?\*(\.\w+)$/);
  if (!m) throw new Error(`Unsupported pattern: ${pattern}`);
  const [, dir, deep, ext] = m;
  const walk = (abs) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.flatMap((e) => {
      const p = path.join(abs, e.name);
      if (e.isDirectory()) return deep ? walk(p) : [];
      return e.name.endsWith(ext) ? [p] : [];
    });
  };
  return walk(path.join(ROOT, dir)).sort();
}

// Template/group JSON files carry a leading /* … */ banner Shopify writes.
function readJson(filePath) {
  try {
    return JSON.parse(read(filePath).replace(/^\s*\/\*[\s\S]*?\*\//, ""));
  } catch {
    return null;
  }
}

function parseSchema(content) {
  const m = content.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// First prose paragraph of a LiquidDoc `{% doc %}` block.
function parseDoc(content) {
  const m = content.match(/\{%-?\s*doc\s*-?%\}([\s\S]*?)\{%-?\s*enddoc\s*-?%\}/);
  if (!m) return "";
  const lines = [];
  for (const line of m[1].split("\n").map((l) => l.trim())) {
    if (line.startsWith("@")) break;
    if (!line) {
      if (lines.length) break;
      continue;
    }
    lines.push(line);
  }
  return lines.join(" ");
}

// Same @capability format as generate-project-map.js (§0 Capability index).
function parseCapabilityBlocks(content) {
  const blocks = [];
  const rawBlocks = [
    ...[...content.matchAll(/\/\*\*[\s\S]*?\*\//g)].map((m) => m[0]),
    ...[...content.matchAll(/(?:^[ \t]*\/\/.*\r?\n?)+/gm)].map((m) => m[0]),
  ];
  for (const raw of rawBlocks) {
    if (!raw.includes("@capability")) continue;
    const tags = {};
    for (const m of raw.matchAll(/(?:\*|\/\/)\s*@(capability|when|keywords|component)\s+(.+)/g)) {
      if (!tags[m[1]]) tags[m[1]] = m[2].trim();
    }
    if (tags.capability) blocks.push(tags);
  }
  return blocks;
}



function t(value) {
  if (typeof value !== "string" || !value.startsWith("t:")) return value || "";
  const resolved = value
    .slice(2)
    .split(".")
    .reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), schemaLocale);
  return typeof resolved === "string" ? resolved : value;
}

function collectTypes(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collectTypes(n, out));
  else if (node && typeof node === "object") {
    if (typeof node.type === "string") out.add(node.type);
    Object.values(node).forEach((v) => collectTypes(v, out));
  }
  return out;
}

function categorize(name, keywords = "") {
  const bare = name.replace(/^_/, "");
  for (const c of CATEGORIES) {
    if (c.test ? c.test(bare) : c.name.test(bare)) return c.id;
  }
  for (const c of CATEGORIES) {
    if (c.kw && c.kw.test(keywords)) return c.id;
  }
  return UNCATEGORIZED.id;
}

function categoryOf(item) {
  return categorize(item.key || item.name, `${item.keywords || ""} ${item.desc}`);
}

// ─── usage maps ─────────────────────────────────────────────────────────────

// type → [where it appears]: templates, section groups, and schema/presets of
// sections + blocks (that's how private `_` blocks are reached).
function buildTypeUsage() {
  const usage = {};
  const add = (type, where) => {
    (usage[type] ||= new Set()).add(where);
  };

  for (const f of [...files("templates/**/*.json"), ...files("sections/*.json")]) {
    const json = readJson(f);
    if (!json) continue;
    const label = rel(f)
      .replace(/^templates\//, "")
      .replace(/^sections\//, "");
    collectTypes(json.sections || {}, new Set()).forEach((type) => add(type, label));
  }

  for (const f of [...files("sections/*.liquid"), ...files("blocks/*.liquid")]) {
    const schema = parseSchema(read(f));
    if (!schema) continue;
    const self = path.basename(f, ".liquid");
    const types = collectTypes([schema.blocks || [], schema.presets || [], schema.default || {}], new Set());
    types.forEach((type) => type !== self && add(type, rel(f).replace(/\.liquid$/, "")));
  }

  return Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, [...v].sort()]));
}

// snippet → [files that render it]
function buildRenderMap() {
  const map = {};
  const liquid = [
    ...files("sections/*.liquid"),
    ...files("blocks/*.liquid"),
    ...files("snippets/*.liquid"),
    ...files("layout/*.liquid"),
  ];
  for (const f of liquid) {
    const seen = new Set();
    for (const m of read(f).matchAll(/\{%-?\s*render\s+['"]([^'"]+)['"]/g)) seen.add(m[1]);
    const from = rel(f).replace(/\.liquid$/, "");
    // A snippet's own {% doc %} @example renders itself — not real usage.
    seen.forEach((n) => from !== `snippets/${n}` && (map[n] ||= []).push(from));
  }
  return map;
}

function buildCustomElements() {
  const byFile = {};
  for (const f of [...files("src/js/modules/*.js"), ...files("src/js/global/*.js")]) {
    for (const m of read(f).matchAll(/customElements\.define\(\s*['"]([^'"]+)['"]/g)) {
      (byFile[rel(f)] ||= []).push(m[1]);
    }
  }
  return byFile;
}

// ─── collectors ─────────────────────────────────────────────────────────────
// Item shape: { kind, name, key?, file, hash, desc, when?, keywords?, note?, usage[], copy }

function collectSections(typeUsage) {
  return files("sections/*.liquid").map((f) => {
    const name = path.basename(f, ".liquid");
    const content = read(f);
    const schema = parseSchema(content) || {};
    const blockTypes = (schema.blocks || []).map((b) => b.type);
    const isAjax = name.startsWith("section-rendering-") || name === "variant-data";
    const note = [
      blockTypes.includes("@theme")
        ? "Nhận theme blocks (@theme)"
        : blockTypes.length
          ? `Section blocks: ${blockTypes.join(", ")}`
          : "",
      isAjax ? "Chỉ dùng cho AJAX / Section Rendering" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      kind: "section",
      name,
      file: rel(f),
      hash: hash(content),
      desc: t(schema.name),
      note,
      usage: typeUsage[name] || [],
      copy: name,
    };
  });
}

function collectBlocks(typeUsage) {
  return files("blocks/*.liquid").map((f) => {
    const name = path.basename(f, ".liquid");
    const content = read(f);
    const schema = parseSchema(content) || {};
    const category = schema.presets?.[0]?.category ? t(schema.presets[0].category) : "";
    return {
      kind: name.startsWith("_") ? "private" : "block",
      name,
      file: rel(f),
      hash: hash(content),
      desc: [t(schema.name), parseDoc(content)].filter(Boolean).join(" — "),
      note: category ? `Editor category: ${category}` : "",
      usage: typeUsage[name] || [],
      copy: `{% content_for 'block', type: '${name}', id: '${name.replace(/^_/, "")}' %}`,
    };
  });
}

function collectSnippets(renderMap) {
  return files("snippets/*.liquid").map((f) => {
    const name = path.basename(f, ".liquid");
    const content = read(f);
    return {
      kind: "snippet",
      name,
      file: rel(f),
      hash: hash(content),
      desc: parseDoc(content),
      usage: renderMap[name] || [],
      copy: `{% render '${name}' %}`,
    };
  });
}

function collectJs(customElements) {
  // src/js/modules copies of src/js/library files are vite output — skip them.
  const libraryNames = new Set(files("src/js/library/*.js").map((f) => path.basename(f)));
  const sources = [
    ...files("src/js/modules/*.js").filter((f) => !libraryNames.has(path.basename(f))),
    ...files("src/js/library/*.js"),
    ...files("src/js/global/*.js"),
  ];
  const items = [];
  for (const f of sources) {
    const base = path.basename(f, ".js");
    const tags = customElements[rel(f)] || [];
    const content = read(f);
    const blocks = parseCapabilityBlocks(content);
    for (const b of blocks.length ? blocks : [{}]) {
      const name = b.component || base;
      const ownTags = tags.includes(name) ? [name] : tags;
      items.push({
        kind: "js",
        name,
        file: rel(f),
        hash: hash(content),
        desc: b.capability || "",
        when: b.when || "",
        keywords: b.keywords || "",
        note: ownTags.length ? ownTags.map((x) => `<${x}>`).join(" ") : "",
        usage: [],
        copy: ownTags.length ? `<${ownTags[0]}></${ownTags[0]}>` : rel(f),
      });
    }
  }
  return items;
}

function collectScss() {
  const items = [];
  const groups = [
    ["src/scss/global/*.scss", (n) => (n.startsWith("_") ? "Gộp vào theme.css" : `→ assets/${n}.css`)],
    ["src/scss/scoped/*.scss", (n) => `→ assets/scoped-${n}.css (section tự nạp)`],
    ["src/scss/modules/*.scss", (n) => `→ assets/${n}.css (bundle riêng)`],
    ["src/scss/components/*.scss", (n) => `→ assets/${n}.css`],
    ["src/scss/mixins/*.scss", () => 'Mixin — @use "../mixins" as *'],
  ];
  for (const [pattern, output] of groups) {
    for (const f of files(pattern)) {
      const raw = path.basename(f, ".scss");
      const name = raw.replace(/^_/, "");
      const content = read(f);
      const cap = parseCapabilityBlocks(content)[0];
      items.push({
        kind: "scss",
        name,
        // Categorise on the bare name: `_component-tabs` and `_section-tabs` both go to "tabs".
        key: name.replace(/^(component|block|section)-/, ""),
        file: rel(f),
        hash: hash(content),
        desc: cap?.capability || "",
        when: cap?.when || "",
        keywords: cap?.keywords || "",
        note: output(raw),
        usage: [],
        copy: rel(f),
      });
    }
  }
  return items;
}

function collectSettings() {
  const schema = readJson(path.join(ROOT, "config/settings_schema.json")) || [];
  return schema
    .filter((g) => Array.isArray(g.settings))
    .map((g) => ({ name: t(g.name), ids: g.settings.filter((s) => s.id).map((s) => s.id) }));
}

function scan(root) {
  ROOT = root;
  schemaLocale = readJson(path.join(ROOT, "locales/en.default.schema.json")) || {};
  const typeUsage = buildTypeUsage();
  const items = [
    ...collectSections(typeUsage),
    ...collectBlocks(typeUsage),
    ...collectSnippets(buildRenderMap()),
    ...collectJs(buildCustomElements()),
    ...collectScss(),
  ];
  return { items, settings: collectSettings() };
}

module.exports = { scan, categoryOf, CATEGORIES, UNCATEGORIZED };
