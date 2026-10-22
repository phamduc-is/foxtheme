# module-catalog

Tool cá nhân: quét một Shopify OS 2.0 theme (thiết kế cho **FoxTheme base** và các fork) rồi sinh `CATALOG.html`. Đây là trang tra cứu các module có sẵn, gom theo nhu cầu, để biết theme đã có gì trước khi code mới.

Tool không cần dependency, chỉ cần Node ≥ 18. Không sửa file nào của theme, chỉ thêm `CATALOG.html` vào `.git/info/exclude` (danh sách ignore cục bộ, không bị commit).

## Cài đặt (1 lần)

```bash
cd ~/Documents/workspace/FoxEcom/module-catalog
./install.sh              # symlink → ~/.local/bin/module-catalog
./install.sh --uninstall  # gỡ
```

## Dùng

```bash
cd <theme>                # thư mục gốc theme hoặc bất kỳ thư mục con nào
module-catalog            # quét → ghi CATALOG.html → mở trình duyệt
module-catalog --no-open  # chỉ ghi file
module-catalog <path>     # quét theme ở <path>
module-catalog --out ~/Desktop/catalog.html
module-catalog --no-diff  # bỏ qua bước so sánh với lần chạy trước
```

**Phạm vi:** tool chỉ chạy với theme nằm trong thư mục chứa nó (`FoxEcom/`). Chạy ở nơi khác sẽ báo `✗ Ngoài phạm vi` và trả về exit 1. Chạy ngay tại `FoxEcom/` thì tool sinh catalog cho **mọi theme** bên trong và không mở trình duyệt. Phạm vi được tính từ vị trí thật của tool; nếu chuyển tool sang thư mục khác thì chạy lại `./install.sh`.

Chạy lại lệnh mỗi khi:

- **Clone theme base mới:** `git clone … && cd … && module-catalog`
- **Update theme base hoặc sync core:** sau `git pull` / `yarn core:sync` → `module-catalog`

## File không được sửa (core)

Section **🔒 Không được sửa** liệt kê mọi file trên đĩa mà child fork không được đụng vào, kể cả file không phải module như `scripts/`, `.claude/`. Danh sách chia theo nhóm, mỗi nhóm ghi lý do và cách làm thay. Rule lấy từ FORK-WORKFLOW.md §5 / §10:

| Mức | Nhóm | Path |
|---|---|---|
| 🔒 Locked | JS engine | `src/js/modules/{component,events,utilities,morph,motion-coordinator,image-coordinator,section-renderer}.js` |
| 🔒 Locked | Thư viện bên thứ ba | `src/js/library/*` + bản vite build cùng tên trong `src/js/modules/` |
| Sync từ core | JS feature modules | phần còn lại của `src/js/modules/**` |
| Sync từ core | JS bootstrap | `src/js/global/*` (trừ `custom.js`) |
| Sync từ core | SCSS mixins | `src/scss/mixins/*` |
| Sync từ core | Tooling | `scripts/**` |
| Sync từ core | Claude toolkit | `.claude/**` (trừ `CHILD.md`, `settings.local.json`, `core-proposals/`) |

- Card của module core có badge 🔒 / Core. Chip **🔒 Core** lọc chỉ hiện các module này.
- Mỗi file core được lưu hash. Lần chạy sau, nếu file nào thêm, sửa hoặc xoá, terminal và trang sẽ cảnh báo `⚠ file core thay đổi`. Ngay sau `core:sync` thì cảnh báo này là bình thường. Ngoài trường hợp đó nghĩa là child đang sửa core.
- Sửa rule ở `lib/protected.js`. Theme không có các thư mục này thì danh sách để trống.

## So sánh với lần chạy trước

Nếu file output đã tồn tại, tool đọc lại data nhúng trong `CATALOG.html` cũ để làm baseline (không cần file snapshot riêng), rồi báo những gì đã thay đổi kể từ lần chạy trước:

| Loại | Cách phát hiện |
|---|---|
| **Mới** | Có trong lần quét này nhưng không có trong baseline |
| **Xoá** | Có trong baseline nhưng không còn nữa |
| **Đổi tên** | Một cặp xoá + mới cùng loại và cùng hash nội dung |
| **Sửa** | Mục có ở cả hai bên nhưng khác ở một trong các điểm: nội dung file (hash sha1), mô tả, `@capability`, ghi chú, nơi dùng (`+…` / `−…`) |
| **Global settings** | Nhóm thêm/bớt, setting `id` thêm/bớt trong từng nhóm |

Kết quả hiện ở hai nơi:

- **Terminal:** một dòng tóm tắt, sau đó liệt kê tối đa 8 mục cho mỗi loại.
- **Trang:** panel "Thay đổi so với lần chạy trước" (bấm vào tên mục để lọc tới card đó), badge Mới/Sửa/Đổi tên trên card, và chip **Thay đổi** để chỉ hiện các mục đã đổi.

Baseline luôn là **lần chạy ngay trước đó**. Chạy lại hai lần liên tiếp mà không sửa gì thì lần thứ hai báo "Không thay đổi". Mỗi lần chạy cũng ghi `branch@sha` của theme, nên dễ biết đang so với commit nào. Catalog tạo bởi bản cũ của tool chưa có hash, nên lần đầu nâng cấp chỉ so được theo field; từ lần chạy sau thì so được cả nội dung file.

## Quét những gì

| Nguồn | Lấy ra |
|---|---|
| `sections/*.liquid` | Tên schema (dịch qua `locales/en.default.schema.json`), `@theme` hay section blocks, template/group đang dùng |
| `blocks/*.liquid` | Public/private (`_`), category trong preset, `{% doc %}`, section/block cha khai báo nó |
| `snippets/*.liquid` | `{% doc %}`, các file đang `render` snippet |
| `src/js/**` | Header `@capability` / `@when` / `@keywords`, tag custom element |
| `src/scss/**` | Header `@capability`, file CSS đầu ra |
| `config/settings_schema.json` | Các nhóm global setting và id |

Theme không có `src/` (theme thường, không có build step) vẫn chạy được: phần JS/SCSS chỉ đơn giản là trống.

## Trang CATALOG.html

Tìm kiếm (phím `/`), lọc theo loại, sidebar danh mục, copy cú pháp `{% render %}` / `{% content_for 'block' %}`, mở file trong VS Code, giao diện sáng/tối. Mọi thứ nằm trong một file, không cần mạng.

## Cấu trúc

```
module-catalog/
├── bin/module-catalog   # CLI: tìm theme root, ghi file, exclude, mở trình duyệt
├── lib/
│   ├── categories.js    # ← rule phân loại, sửa ở đây
│   ├── scan.js          # đọc theme → items + settings
│   ├── diff.js          # đọc CATALOG.html cũ → so sánh với lần quét mới
│   ├── protected.js     # ← rule file core không được sửa
│   ├── render.js        # items → HTML
│   └── template.html    # giao diện (CSS + JS của trang)
├── install.sh
└── package.json
```

## Tuỳ chỉnh danh mục

Sửa `lib/categories.js`. Một mục thuộc danh mục **đầu tiên** có `name` (regex) khớp với tên của nó, nên rule cụ thể phải đặt trước rule chung. Nếu không khớp theo tên, tool thử `kw` trên keyword lấy từ `@capability`. Terminal báo `⚠ N mục chưa phân loại` thì thêm rule cho các mục đó.
