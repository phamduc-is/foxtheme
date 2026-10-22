/** Renders catalog items into one self-contained HTML page (data inlined, no network). */

const fs = require("fs");
const path = require("path");
const { categoryOf, CATEGORIES, UNCATEGORIZED } = require("./scan");
const { idOf } = require("./diff");
const { protectionIndex } = require("./protected");

// ─── render (self-contained HTML: data inlined, no network) ─────────────────

const KINDS = [
  { id: "section", label: "Section" },
  { id: "block", label: "Block" },
  { id: "private", label: "Private block" },
  { id: "snippet", label: "Snippet" },
  { id: "js", label: "JS" },
  { id: "scss", label: "SCSS" },
];

function renderHtml(root, items, settings, { diff = null, git = null, protectedGroups = [] } = {}) {
  const protection = protectionIndex(protectedGroups);
  const order = KINDS.map((k) => k.id);
  const cats = [...CATEGORIES, UNCATEGORIZED]
    .map((c) => ({
      id: c.id,
      title: c.title,
      need: c.need,
      items: items
        .filter((i) => categoryOf(i) === c.id)
        .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name)),
    }))
    .filter((c) => c.items.length);

  const data = {
    root,
    generated: new Date().toLocaleString("vi-VN"),
    generatedAt: new Date().toISOString(),
    git,
    kinds: KINDS,
    cats: cats.map(({ id, title, need, items }) => ({
      id,
      title,
      need,
      // `change` is per run only: the next run diffs against hash/desc/usage, never this.
      items: items.map(({ key, ...rest }) => ({
        ...rest,
        ...(diff?.byId[idOf(rest)] && { change: diff.byId[idOf(rest)] }),
        ...(protection[rest.file] && { protect: protection[rest.file] }),
      })),
    })),
    settings,
    protected: protectedGroups,
    diff: diff && { ...diff, byId: undefined },
  };
  // `<` escaped so no string in the data can close the <script> early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const template = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
  return template.replace("__DATA__", () => json);
}
module.exports = { renderHtml };
