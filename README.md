# Việc & Nhật ký

Tiếng Việt · [English](README.en.md)

Ứng dụng quản lý công việc cá nhân kèm nhật ký hằng ngày. Một backend Supabase, hai ứng dụng độc lập:

| | Công nghệ | Thư mục |
|---|---|---|
| **Web** | Angular 21 (standalone components, signals, lazy routes), SCSS | [`apps/web`](apps/web/README.md) |
| **Mobile** (iOS/Android) | Expo SDK 58, React Native 0.88, Expo Router | [`apps/mobile`](apps/mobile/README.md) |
| **Backend** | Supabase: Postgres + RLS, Auth (email/mật khẩu, Google), Realtime, 2 RPC | [`supabase/`](supabase) |
| **Logic dùng chung** | TypeScript thuần, không phụ thuộc framework | [`packages/core`](packages/core) |

Web không còn dùng Expo hay React Native Web. Hai app không chia sẻ UI; chỉ chia sẻ backend, hợp đồng dữ liệu và quy tắc nghiệp vụ.

## Tính năng

- **Hôm nay / Hộp thư / Sắp tới**: việc theo ngày, việc chưa vào project, việc sắp đến hạn (khoảng 3 ngày tới cả năm, hoặc tự chọn).
- **Project**, **việc con** có giờ riêng, **việc lặp lại** (hằng ngày, theo thứ, theo ngày trong tháng, mỗi N ngày).
- **Nhật ký**: việc đã xong theo ngày, lịch tháng, biểu đồ, ghi chú tự do cho từng ngày.
- **Báo cáo ngày**: soạn rich text, hạn 21:00, nộp trễ bị đánh dấu, chuỗi ngày đúng hạn.
- **Nhãn** `#nhãn`, **tìm kiếm** không phân biệt dấu, **thống kê** tuần/tháng.
- **Gõ nhanh có cú pháp**: `Họp nhóm mai 9h !1 #công-việc` tự đặt ngày, giờ, ưu tiên, nhãn.
- **Dời việc** (Mai / Tuần sau / dời cả nhóm quá hạn) và **hoàn tác** 10 giây sau khi dời hoặc xoá.
- Đăng nhập email/mật khẩu hoặc Google, liên kết Google, quên mật khẩu. Sáng/tối, màu nhấn, tiếng Việt/English.
- Mobile thêm: nhắc việc bằng thông báo, vuốt để xong/dời, haptics.

## Bắt đầu

Yêu cầu: Node.js 22.18+ (khuyến nghị 22 LTS hoặc 24), một project Supabase.

```bash
cp .env.example .env.local        # URL, publishable key, mật khẩu DB (chỉ cho db:push)
npm run install:all               # cài riêng apps/web và apps/mobile
npm run db:push                   # áp migration lên DB (người dùng tự chạy với DB thật)

npm run web                       # Angular: http://localhost:4200
npm run mobile                    # Expo dev server (cần apps/mobile/.env.local)
```

## Lệnh ở thư mục gốc

| Lệnh | Việc |
|---|---|
| `npm run web` / `web:build` / `web:check` / `web:e2e` | chạy, build production, lint+typecheck+unit test, E2E Playwright cho web |
| `npm run mobile` / `mobile:android` / `mobile:check` | Expo dev server, build Android, lint+typecheck+test cho mobile |
| `npm run core:test` | kiểm tra quy tắc nghiệp vụ và bản dịch (`packages/core`) |
| `npm run check` | tất cả các kiểm tra trên, trước khi commit |
| `npm run db:push` | áp `supabase/migrations` lên DB qua IPv4 pooler |

Build web không phụ thuộc Expo; build mobile không phụ thuộc Angular. Mỗi app có `node_modules` và lockfile riêng.

## Cấu trúc

```
apps/web/          Angular app (xem apps/web/README.md)
apps/mobile/       Expo app, giữ nguyên như trước khi tách
packages/core/     ngày, lặp lại, nhật ký, báo cáo, nhãn, cú pháp gõ nhanh, i18n, kiểu dữ liệu
supabase/          migrations, schema.sql (bản đầy đủ), mẫu email
scripts/           supabase.mjs (CLI qua IPv4 pooler)
docs/              architecture/, api/, development/, migration/, design/, plans/
```

Tài liệu: [kiến trúc](docs/architecture/overview.md) · [cài đặt & triển khai](docs/development/setup.md) · [API contracts](docs/api/contracts.md) · [hướng dẫn Flutter](docs/api/flutter-guide.md) · [ghi chú migration](docs/migration/angular-web.md).

## Triển khai

- **Web**: Vercel tự deploy khi `main` thay đổi (`vercel.json`: `npm ci --prefix apps/web` → `npm run build --prefix apps/web` → `apps/web/dist/web/browser`, rewrite SPA). Biến môi trường trên Vercel: `SUPABASE_URL`, `SUPABASE_KEY` (tên cũ `EXPO_PUBLIC_SUPABASE_*` vẫn được đọc).
- **Mobile**: development build, chưa lên store. Xem [apps/mobile/README.md](apps/mobile/README.md).
- **DB**: có migration mới thì `npm run db:push` trước khi merge.

Cấu hình Supabase Auth (Redirect URLs, Google, mẫu email): [docs/development/setup.md](docs/development/setup.md#supabase-auth).

## Giấy phép

MIT, xem [LICENSE](LICENSE).
