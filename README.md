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
- **Nhắc việc** qua thông báo (chỉ trên iOS/Android).
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

> Thông báo nhắc việc cần development build (`npx expo run:ios|android` hoặc `eas build --profile development`), Expo Go không đủ.

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

Dữ liệu gồm 4 bảng: `projects`, `tasks`, `subtasks`, `daily_reports`, đều bật RLS theo từng người dùng.

## Triển khai web

Web được deploy lên Vercel (`vercel.json`): build bằng `npx expo export -p web`, xuất ra `dist/`, chỉ tự deploy từ nhánh `main`. Đặt hai biến `EXPO_PUBLIC_SUPABASE_*` trong project Vercel.

## Giấy phép

MIT, xem [LICENSE](LICENSE).
