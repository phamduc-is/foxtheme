/**
 * Files a child fork must NOT change — core modules synced down from foxtheme-base.
 * Source: FORK-WORKFLOW.md §5 "Tuyệt đối không được sửa" + §10 "Bảng phân loại file"
 * + .gitattributes. Edit the rules here when that policy changes.
 *
 * A file belongs to the FIRST rule whose `match` returns true. `level`:
 *   "locked" — never edit in a child (engine, vendored libs)
 *   "core"   — synced from core; a child edit becomes a conflict on every core:sync
 * Themes without these folders (no src/, no scripts/) simply get an empty list.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ENGINE = new Set([
  "component.js",
  "events.js",
  "utilities.js",
  "morph.js",
  "motion-coordinator.js",
  "image-coordinator.js",
  "section-renderer.js",
]);

// Child-owned paths inside otherwise core folders — never listed.
const CHILD_OWNED = [
  /^src\/js\/custom\//,
  /^src\/js\/global\/custom\.js$/,
  /^\.claude\/CHILD\.md$/,
  /^\.claude\/settings\.local\.json$/,
  /^\.claude\/core-proposals\//,
];

const RULES = [
  {
    id: "engine",
    level: "locked",
    title: "JS engine",
    why: "Base class, event bus, morph, Section Rendering và các coordinator. Mọi component khác đều dựa vào các file này.",
    instead: "Bug nằm trong core thì dùng /fix-core <file> \"<fix>\" để sửa ở foxtheme-base rồi sync xuống.",
    match: (f) => f.startsWith("src/js/modules/") && ENGINE.has(path.basename(f)) && !f.includes("/carousel/"),
  },
  {
    id: "library",
    level: "locked",
    title: "Thư viện bên thứ ba",
    why: "Swiper, Motion, Lenis, PhotoSwipe, polyfill. src/js/library là nguồn; file cùng tên trong src/js/modules là output của vite.",
    instead: "Nâng version dependency ở core. Cần hành vi khác thì bọc lại trong src/js/custom/.",
    match: (f, ctx) =>
      f.startsWith("src/js/library/") ||
      (f.startsWith("src/js/modules/") && path.dirname(f) === "src/js/modules" && ctx.libraryNames.has(path.basename(f))),
  },
  {
    id: "modules",
    level: "core",
    title: "JS feature modules",
    why: "Custom element của core (cart, product, variant, carousel…). Child sửa ở đây thì mỗi lần core:sync sẽ conflict, và resolve chuẩn là lấy bản core (--theirs).",
    instead: "Tạo src/js/custom/<name>-extended.js, import module gốc rồi override phần cần, sau đó thêm script tag vào snippets/scripts.liquid.",
    match: (f) => f.startsWith("src/js/modules/"),
  },
  {
    id: "bootstrap",
    level: "core",
    title: "JS bootstrap",
    why: "theme.js và modules.js khởi động toàn bộ theme.",
    instead: "JS riêng của child đặt ở src/js/custom/ (xem hướng dẫn trong src/js/global/custom.js).",
    match: (f) => f.startsWith("src/js/global/"),
  },
  {
    id: "mixins",
    level: "core",
    title: "SCSS mixins",
    why: "Breakpoint và biến hạ tầng mà toàn bộ SCSS dùng chung.",
    instead: "Restyle ở _component-* / _block-* / _section-* hoặc token (_typography, _base…). Đó là design layer mà child được sửa.",
    match: (f) => f.startsWith("src/scss/mixins/"),
  },
  {
    id: "tooling",
    level: "core",
    title: "Tooling (build, check, sync, release)",
    why: "Script build/check/core-sync dùng chung cho mọi fork. Sửa ở child sẽ lệch khỏi CI và các check ratchet.",
    instead: "Cần thêm tooling thì đề xuất lên core (/fix-core hoặc PR vào foxtheme-base).",
    match: (f) => f.startsWith("scripts/"),
  },
  {
    id: "toolkit",
    level: "core",
    title: "Claude toolkit",
    why: "Skill, agent, command, hook do core sở hữu và inherit xuống mọi fork qua core:sync.",
    instead: "Quy ước riêng của child ghi vào .claude/CHILD.md. Bài học dùng chung thì dùng propose-core. Override cá nhân để ở .claude/settings.local.json.",
    match: (f) => f.startsWith(".claude/"),
  },
];

const WALK_ROOTS = ["src/js", "src/scss/mixins", "scripts", ".claude"];

function walk(abs, root) {
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p, root);
    return e.isFile() && !e.name.startsWith(".DS_Store") ? [path.relative(root, p).replace(/\\/g, "/")] : [];
  });
}

function context(root) {
  let libraryNames = new Set();
  try {
    libraryNames = new Set(fs.readdirSync(path.join(root, "src/js/library")).filter((n) => n.endsWith(".js")));
  } catch {}
  return { libraryNames };
}

function ruleFor(file, ctx) {
  if (CHILD_OWNED.some((re) => re.test(file))) return null;
  return RULES.find((r) => r.match(file, ctx)) || null;
}

function hashFile(abs) {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(abs)).digest("hex").slice(0, 12);
  } catch {
    return "";
  }
}

/** Every protected file on disk, grouped by rule (empty groups dropped). */
function protectedGroups(root) {
  const ctx = context(root);
  const groups = RULES.map(({ match, ...rule }) => ({ ...rule, files: [] }));
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  for (const dir of WALK_ROOTS) {
    for (const file of walk(path.join(root, dir), root).sort()) {
      const rule = ruleFor(file, ctx);
      if (rule) byId[rule.id].files.push({ file, hash: hashFile(path.join(root, file)) });
    }
  }
  return groups.filter((g) => g.files.length);
}

/** Lookup for catalog items: file → { level, group } | null. */
function protectionIndex(groups) {
  const index = {};
  for (const g of groups) for (const f of g.files) index[f.file] = { level: g.level, group: g.title };
  return index;
}

module.exports = { protectedGroups, protectionIndex, RULES };
