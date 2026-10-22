/**
 * Category rules for module-catalog — edit freely.
 *
 * An item goes to the FIRST category whose `test`/`name` matches its name
 * (leading `_` stripped; SCSS uses the name without component-/block-/section-).
 * If none matches by name, the first category whose `kw` matches the item's
 * @capability keywords/description wins. Anything left over shows up under
 * "Chưa phân loại" — add a rule here when that happens.
 */

// ─── categories ─────────────────────────────────────────────────────────────
// Order matters: specific rules come before generic ones (compare/cart/search
// before product, recommendation before collection, …).

const FOUNDATION = new Set([
  "component",
  "events",
  "utilities",
  "morph",
  "section-renderer",
  "image-coordinator",
  "motion-coordinator",
  "performance",
  "standard-events",
  "custom-elements",
  "breakpoints",
  "media",
  "helpers",
  "layout",
  "spacing",
  "typography",
  "resets",
  "base",
  "variables",
  "css-variables",
  "color-schemes",
  "fonts",
  "meta-tags",
  "scripts",
  "styles",
  "critical-css",
  "theme-name",
  "theme-version",
  "skip-to-content-link",
  "theme",
  "modules",
  "custom",
  "standard-view-event",
  "blocks",
  "sections",
  "index",
  "rtl",
  "rtl-base",
  "rtl-custom",
  "non-critical",
  "page-policy",
  "loading-spinner",
]);

const CATEGORIES = [
  {
    id: "foundation",
    title: "Nền tảng & engine",
    need: "Base class JS, event, morph, biến CSS, breakpoint, font, head — engine core, child KHÔNG sửa",
    test: (n) => FOUNDATION.has(n),
  },
  {
    id: "style-utils",
    title: "Style emitter (CSS variable từ settings)",
    need: "Đổ padding/border/gap/size/typography từ settings ra CSS variable",
    name: /-style$|^clamp-calculate/,
  },
  {
    id: "compare",
    title: "So sánh sản phẩm",
    need: "Compare bar, bảng/dialog so sánh",
    name: /^compare|rendering-compare|quick-comparison/,
  },
  {
    id: "quiz",
    title: "Quiz & product finder",
    need: "Quiz gợi ý sản phẩm, bộ lọc tìm sản phẩm theo câu hỏi",
    name: /quiz|finder/,
  },
  {
    id: "cart",
    title: "Cart",
    need: "Cart drawer/page, discount, note, shipping, free-ship bar, gói quà, cart count",
    name: /(?<!add-to-)cart|free-shipping|gift-wrap|local-pickup/,
  },
  { id: "search", title: "Search", need: "Predictive search, search drawer, trang kết quả", name: /search/ },
  {
    id: "account",
    title: "Account & trang hệ thống",
    need: "Login/register/account/order, password, 404, page",
    name: /account|login|register|addresses|^order|main-order|reset-password|password|main-404|main-page|^page-(title|content)|customer|gift-?card/,
  },
  { id: "blog", title: "Blog & article", need: "Blog list, article card, trang article", name: /blog|article|author/ },
  {
    id: "footer",
    title: "Footer & social",
    need: "Footer column/menu, social icons, share",
    name: /footer|social|payment-icons/,
  },
  {
    id: "header",
    title: "Header, menu & điều hướng",
    need: "Header, menu desktop/drawer, mega menu, top bar, announcement, localization, breadcrumbs",
    name: /^(header|menu|desktop-menu|mega|top-bar|announcement|logo|localization|breadcrumb|details-|dropdown)/,
  },
  {
    id: "product-card",
    title: "Product card",
    need: "Card sản phẩm, quick add, swatch, badge trên card",
    name: /product-card|quick-add|swatch|badge/,
  },
  {
    id: "recommendation",
    title: "Gợi ý, bundle & upsell",
    need: "Recommendations, recently viewed, bundle, FBT, featured collection, product tabs",
    name: /recommend|recently-viewed|bundle|fbt|featured-collection|product-tabs/,
  },
  {
    id: "collection",
    title: "Collection, filter & listing",
    need: "Trang collection, filter/sort, pagination, collection card/list, quick order list",
    name: /collection|facet|filter|sorting|paginat|product-grid|results-list|quick-order|show-more/,
  },
  {
    id: "product",
    title: "Trang product",
    need: "Product info, variant picker, buy buttons, giá, tồn kho, pickup, quantity, sticky ATC, quick view",
    name: /product|variant|quantity|buy-button|add-to-car|accelerated|pickup|inventory|price|tax-info|quick-view|zoom|share|rating-star/,
  },
  {
    id: "carousel",
    title: "Slider & carousel",
    need: "Carousel/slider Swiper, slideshow, slide",
    name: /carousel|slide|swiper/,
  },
  { id: "hero", title: "Banner & hero", need: "Hero banner, banner có nội dung/marquee", name: /hero|banner/ },
  {
    id: "motion",
    title: "Animation & motion",
    need: "Hiệu ứng khi cuộn (data-motion), stagger, page transition, smooth scroll, parallax",
    name: /^motion|animation|lenis|page-transition|keyframes|parallax|reveal|scroll-progress/,
    kw: /animation|motion|parallax|transition/,
  },
  {
    id: "marketing",
    title: "Marketing & nội dung",
    need: "Testimonial, icon box/list, countdown, counter, promotion alert, marquee, lookbook",
    name: /testimonial|icon-box|icon-list|countdown|counter|promotion|marquee|lookbook|press/,
  },
  {
    id: "interactive",
    title: "Tương tác UI",
    need: "Accordion, tabs, dialog/modal, popup, tooltip, back-to-top, copy, QR, overlay",
    name: /accordion|tab|dialog|popup|tooltip|back-to-top|copy-to-clipboard|qr-code|overlay|collapse|read-more/,
    kw: /accordion|tabs|dialog|modal|popup|tooltip/,
  },
  {
    id: "forms",
    title: "Form & map",
    need: "Newsletter, contact form, field, checkbox, input, maps",
    name: /newsletter|contact|field|checkbox|form|maps/,
  },
  {
    id: "media",
    title: "Media: ảnh, video, icon",
    need: "Ảnh responsive, image card, so sánh ảnh, video, icon, gallery",
    name: /image|video|icon|media|gallery|photoswipe|picture|model/,
  },
  {
    id: "text",
    title: "Text & typography",
    need: "Heading, text, label, highlight text, collapsible text",
    name: /text|heading|label|highlight|title|content|description|label/,
  },
  {
    id: "layout",
    title: "Layout & khung",
    need: "Section tự do, group/grid, scroll row, divider, spacer, sticky column, custom liquid",
    name: /custom|group|grid|scroll-row|swipe|divider|spacer|separator|sticky|edge-shadows|layout|section-header|list-item|table|link|button|label|tooltip|social/,
  },
];
const UNCATEGORIZED = {
  id: "uncategorized",
  title: "Chưa phân loại",
  need: "Không khớp rule nào — thêm rule vào CATEGORIES trong module-catalog/lib/categories.js",
};

module.exports = { CATEGORIES, UNCATEGORIZED };
