/**
 * Compares a fresh scan with the previous CATALOG.html. The page already inlines
 * its data (`const DATA = …;`), so the last output IS the baseline — no extra
 * snapshot file. Catalogs written before item hashes existed still diff on their
 * fields (desc, usage, note…); content changes show up from the next run on.
 */

const fs = require("fs");
const path = require("path");

const idOf = (item) => `${item.file}#${item.name}`;

// Pull DATA back out of a page this tool wrote. Anything else → null (first run).
function readPrevious(outFile) {
  let html;
  try {
    html = fs.readFileSync(outFile, "utf8");
  } catch {
    return null;
  }
  const m = html.match(/^const DATA = (.*);$/m);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    return {
      generated: data.generated || "",
      generatedAt: data.generatedAt || null,
      git: data.git || null,
      items: (data.cats || []).flatMap((c) => c.items || []),
      settings: data.settings || [],
      // Absent in catalogs written before the protected list existed → not diffed.
      protected: data.protected ? data.protected.flatMap((g) => g.files) : null,
    };
  } catch {
    return null;
  }
}

// HEAD of the theme repo, read from .git without spawning git. Best effort.
function gitHead(root) {
  try {
    let gitDir = path.join(root, ".git");
    if (fs.statSync(gitDir).isFile()) {
      // Worktree: `.git` is a file pointing at the real git dir.
      gitDir = path.resolve(root, fs.readFileSync(gitDir, "utf8").replace(/^gitdir:\s*/, "").trim());
    }
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref:")) return { branch: null, sha: head.slice(0, 8) };
    const ref = head.slice(4).trim();
    const branch = ref.replace(/^refs\/heads\//, "");
    // Refs may live in the common dir (worktrees) or in packed-refs.
    const commonFile = path.join(gitDir, "commondir");
    const common = fs.existsSync(commonFile) ? path.resolve(gitDir, fs.readFileSync(commonFile, "utf8").trim()) : gitDir;
    for (const dir of [gitDir, common]) {
      const loose = path.join(dir, ref);
      if (fs.existsSync(loose)) return { branch, sha: fs.readFileSync(loose, "utf8").trim().slice(0, 8) };
    }
    const packed = fs.readFileSync(path.join(common, "packed-refs"), "utf8");
    const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
    return { branch, sha: line ? line.slice(0, 8) : null };
  } catch {
    return null;
  }
}

function setDiff(before = [], after = []) {
  const a = new Set(before);
  const b = new Set(after);
  return { added: [...b].filter((x) => !a.has(x)), removed: [...a].filter((x) => !b.has(x)) };
}

// Why an item that exists on both sides changed (empty = unchanged).
function reasonsFor(prev, next) {
  const reasons = [];
  if (prev.hash && next.hash && prev.hash !== next.hash) reasons.push("nội dung file");
  if ((prev.desc || "") !== (next.desc || "")) reasons.push("mô tả");
  if ((prev.when || "") !== (next.when || "") || (prev.keywords || "") !== (next.keywords || "")) reasons.push("@capability");
  if ((prev.note || "") !== (next.note || "")) reasons.push("ghi chú");
  const usage = setDiff(prev.usage, next.usage);
  if (usage.added.length || usage.removed.length) {
    const parts = [
      usage.added.length ? `+${usage.added.join(", +")}` : "",
      usage.removed.length ? `−${usage.removed.join(", −")}` : "",
    ].filter(Boolean);
    reasons.push(`nơi dùng (${parts.join(" ")})`);
  }
  return reasons;
}

function diffSettings(prev, next) {
  const before = new Map(prev.map((g) => [g.name, g.ids]));
  const after = new Map(next.map((g) => [g.name, g.ids]));
  const groups = setDiff([...before.keys()], [...after.keys()]);
  const ids = [];
  for (const [name, list] of after) {
    if (!before.has(name)) continue;
    const d = setDiff(before.get(name), list);
    if (d.added.length || d.removed.length) ids.push({ group: name, ...d });
  }
  return { addedGroups: groups.added, removedGroups: groups.removed, ids };
}

// Core files (incl. ones that are not catalog items, e.g. scripts/) by content hash.
function diffProtected(prev, groups) {
  if (!prev) return [];
  const before = new Map(prev.map((f) => [f.file, f.hash]));
  const after = new Map(groups.flatMap((g) => g.files.map((f) => [f.file, { hash: f.hash, level: g.level }])));
  const out = [];
  for (const [file, { hash, level }] of after) {
    if (!before.has(file)) out.push({ file, level, type: "added" });
    else if (before.get(file) && hash && before.get(file) !== hash) out.push({ file, level, type: "changed" });
  }
  for (const file of before.keys()) if (!after.has(file)) out.push({ file, level: null, type: "removed" });
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function brief(item) {
  return { name: item.name, kind: item.kind, file: item.file };
}

/**
 * @returns {null | {
 *   prev: { generated, generatedAt, git },
 *   byId: Record<string, { type: "added"|"changed"|"renamed", reasons: string[], from?: string }>,
 *   added, changed, renamed, removed, settings, protected, total
 * }}
 */
function diffCatalog(previous, items, settings, protectedGroups = []) {
  if (!previous) return null;
  const prevById = new Map(previous.items.map((i) => [idOf(i), i]));
  const nextById = new Map(items.map((i) => [idOf(i), i]));

  let added = items.filter((i) => !prevById.has(idOf(i)));
  let removed = previous.items.filter((i) => !nextById.has(idOf(i)));

  // A removed + added pair with the same kind and the same content = a rename.
  const renamed = [];
  for (const item of [...added]) {
    if (!item.hash) continue;
    const match = removed.find((r) => r.hash === item.hash && r.kind === item.kind);
    if (!match) continue;
    renamed.push({ from: brief(match), to: brief(item), id: idOf(item) });
    added = added.filter((a) => a !== item);
    removed = removed.filter((r) => r !== match);
  }

  const changed = [];
  for (const item of items) {
    const prev = prevById.get(idOf(item));
    if (!prev) continue;
    const reasons = reasonsFor(prev, item);
    if (reasons.length) changed.push({ ...brief(item), id: idOf(item), reasons });
  }

  const byId = {};
  added.forEach((i) => (byId[idOf(i)] = { type: "added", reasons: [] }));
  changed.forEach((c) => (byId[c.id] = { type: "changed", reasons: c.reasons }));
  renamed.forEach((r) => (byId[r.id] = { type: "renamed", reasons: [], from: r.from.name }));

  const settingsDiff = diffSettings(previous.settings, settings);
  const settingsCount =
    settingsDiff.addedGroups.length +
    settingsDiff.removedGroups.length +
    settingsDiff.ids.reduce((n, g) => n + g.added.length + g.removed.length, 0);

  const protectedChanges = diffProtected(previous.protected, protectedGroups);

  return {
    prev: { generated: previous.generated, generatedAt: previous.generatedAt, git: previous.git },
    byId,
    added: added.map(brief),
    changed: changed.map(({ id, ...rest }) => rest),
    renamed: renamed.map(({ from, to }) => ({ from, to })),
    removed: removed.map(brief),
    settings: settingsDiff,
    protected: protectedChanges,
    total: added.length + changed.length + renamed.length + removed.length + settingsCount + protectedChanges.length,
  };
}

module.exports = { readPrevious, diffCatalog, gitHead, idOf };
