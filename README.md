# Việc & Nhật ký

Tiếng Việt · [English](README.en.md)

Ứng dụng quản lý công việc cá nhân kèm nhật ký hằng ngày. Chạy trên iOS, Android và web (web có bố cục rộng từ 1024px). Giao diện tiếng Việt, có bản tiếng Anh.

## Tính năng

- **Hôm nay / Hộp thư / Sắp tới**: xem việc theo ngày, việc chưa lên lịch và việc sắp đến hạn.
- **Dự án**: gom việc theo dự án.
- **Việc con** (subtask) có ngày và giờ riêng.
- **Việc lặp lại**: hằng ngày, theo thứ trong tuần, theo ngày trong tháng, hoặc mỗi N ngày.
- **Nhật ký**: mỗi việc đã xong được ghi lại theo ngày hoàn thành.
- **Báo cáo ngày**: mỗi ngày một báo cáo (soạn thảo rich text), hạn 21:00, nộp muộn sẽ bị đánh dấu.
- **Chuỗi đúng hạn**: đếm số ngày liên tiếp nộp báo cáo trước 21:00.
- **Nhãn** (`#nhãn`): gắn nhãn cho việc, chọn lại nhãn đã dùng thay vì gõ lại, lọc theo nhãn.
- **Tìm kiếm**: tìm theo tên và ghi chú (không phân biệt dấu), lọc theo `#nhãn`.
- **Gõ nhanh có cú pháp**: `Họp nhóm mai 9h !1 #công-việc` tự đặt ngày, giờ, ưu tiên và nhãn. Khi gõ có gợi ý cú pháp và hiện trước những gì sẽ được lưu.
- **Dời việc**: "Mai" / "Tuần sau" ngay trên từng việc, "Dời sang hôm nay" cho cả nhóm quá hạn.
- **Hoàn tác** trên thông báo (10 giây, có đếm ngược) sau khi dời hoặc xoá việc.
- **Thống kê tuần/tháng**: số việc xong so với kỳ trước, việc lỡ hạn, tỉ lệ đúng hạn, theo dự án và theo nhãn.
- **Ghi chú tự do** cho từng ngày trong nhật ký.
- **Nhắc việc** qua thông báo (chỉ trên iOS/Android).
- **Đăng nhập** bằng email/mật khẩu hoặc Google; liên kết và gỡ liên kết tài khoản Google trong Cài đặt; quên mật khẩu qua email.
- Chế độ sáng/tối, đổi ngôn ngữ và màu nhấn trong Cài đặt.

## Công nghệ

Expo SDK 58 (Expo Router, typed routes), React 19, React Native 0.88, TypeScript, Supabase (auth + Postgres). Font Be Vietnam Pro.

## Cài đặt

Yêu cầu Node.js 22.18+ (`npm test` chạy file `.ts` trực tiếp bằng node) và một project Supabase.

```bash
npm install
cp .env.example .env.local   # điền URL, key và mật khẩu DB của Supabase
npm run db:push              # tạo bảng trên DB Supabase
npm start                    # rồi bấm w (web), i (iOS) hoặc a (Android)
```

Biến môi trường (`.env.local`):

| Biến | Dùng cho |
|------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `EXPO_PUBLIC_SUPABASE_KEY` | anon / publishable key |
| `SUPABASE_DB_PASSWORD` | chỉ dùng cho `npm run db:push`, **không** thêm tiền tố `EXPO_PUBLIC_` |

Mẫu email xác nhận đăng ký và đặt lại mật khẩu nằm ở `supabase/templates/`, dán vào Supabase Dashboard > Authentication > Email Templates.

> Thông báo nhắc việc và đăng nhập Google trên điện thoại cần development build (`npx expo run:ios|android` hoặc `eas build --profile development`), Expo Go không đủ.

## Lệnh

```bash
npm start           # dev server (npm run web / ios / android)
npm run lint        # expo lint
npm run typecheck   # tsc --noEmit
npm test            # kiểm tra logic ngày, nhật ký, i18n
npm run db:push     # áp các migration trong supabase/migrations lên DB
```

Trước khi commit: `npm run lint && npm run typecheck && npm test`.

## Cấu trúc

```
src/app/          các màn hình (Expo Router)
src/components/   UI dùng chung (ui.tsx) và các component; dom/ là Expo DOM components
src/constants/    theme: màu, token, font
src/lib/          supabase client, xử lý ngày, nhật ký, báo cáo, nhắc việc, i18n
supabase/         migrations, schema.sql (bản đầy đủ), mẫu email
docs/             kế hoạch và tài liệu design system
```

Dữ liệu gồm 5 bảng: `projects`, `tasks`, `subtasks`, `daily_reports`, `journal_notes`, đều bật RLS theo từng người dùng.

## Triển khai

Quy trình hiện tại:

1. Làm trên một nhánh riêng, chạy `npm run lint && npm run typecheck && npm test`.
2. Có migration mới thì chạy `npm run db:push` **trước khi merge**, để DB có sẵn cột/bảng khi bản web mới lên.
3. Mở PR vào `main` trên GitHub rồi merge.
4. **Vercel** tự build và deploy khi `main` thay đổi (các nhánh khác không deploy, xem `vercel.json`): build bằng `npx expo export -p web`, xuất ra `dist/`, mọi đường dẫn trả về `index.html`. Đặt hai biến `EXPO_PUBLIC_SUPABASE_*` trong project Vercel.

### Cấu hình Supabase Auth (làm một lần trên Dashboard)

- **URL Configuration**: *Site URL* là domain web chính. *Redirect URLs* liệt kê đúng các URL app quay về, cho từng nơi chạy (domain Vercel, `http://localhost:8081`, `taskapp://`):
  - `/` (đăng nhập Google), `/settings` (liên kết Google), `/reset-password` (quên mật khẩu).
  - Ví dụ: `https://<domain>/settings`, `taskapp://settings`. URL không có trong danh sách sẽ bị đưa về Site URL.
- **Google**: tạo OAuth client loại *Web application* trên Google Cloud, redirect URI `https://<project>.supabase.co/auth/v1/callback`; dán Client ID/Secret vào *Sign In / Providers → Google*; bật *Allow manual linking* để liên kết được Gmail khác email tài khoản. Khi app Google còn ở chế độ *Testing*, chỉ các Gmail trong *Test users* đăng nhập được.
- **Email Templates**: dán mẫu từ `supabase/templates/`.

### Điện thoại

Chưa phát hành lên store. Chạy bằng development build (`npx expo run:ios|android`); cần build lại mỗi khi thêm thư viện có code native (vd. `expo-web-browser`, `expo-notifications`).

## Giấy phép

MIT, xem [LICENSE](LICENSE).
