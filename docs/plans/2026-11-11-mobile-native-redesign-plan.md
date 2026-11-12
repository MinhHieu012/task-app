# Thiết kế lại giao diện mobile: từ "web thu nhỏ" sang app điện thoại

> Hallmark · audit → redesign plan · scope: app (màn hình làm việc) · depth: **full** cho mobile, **không động** vào layout web rộng (>= 1024px)
> Ngày: 2026-11-11 · Thiết bị chụp: Galaxy S23 (SM-S911N, 1080x2340, Android) qua adb, bản dev build, accent Biển, theme sáng.
> Ảnh "before": `.hallmark/before-mobile/*.png` (14 ảnh, gitignored).

---

## 1. Kết luận nhanh

- **App dùng để làm gì trên điện thoại:** mở ra lúc đang đi hoặc đầu ngày, xem hôm nay có gì, tick xong, ghi nhanh một việc, tối viết báo cáo. Các việc này cần **một tay, vài giây**.
- **Phần đang tốt, giữ lại:** hệ màu/token trong `theme.ts` (accent do người dùng chọn, neutral ấm theo accent, chữ đủ tương phản), font Be Vietnam Pro, cú pháp thêm nhanh (`mai 9h !1 #tag`) với chip gợi ý, toast có hoàn tác, tick có "pop", empty state có hành động, thanh tab dưới đã có sẵn.
- **Phần làm nó trông như web thu nhỏ:** mọi màn đều là *một trang web xếp dọc*: tiêu đề H1 + dòng phụ + nút chữ bên phải, rồi một chồng **card trắng có viền** đặt trên nền, mỗi card padding 20/24 bên trong lề 16. Mobile chỉ được *bớt đi* (`!wide && ...`), chưa có một tương tác nào được thiết kế riêng cho ngón tay: không vuốt, không nhấn giữ, không bottom sheet, không pull-to-refresh, không haptic, form sửa việc là form web dài 3 màn hình.
- **Phần hỏng thật:** tiêu đề project bị bẻ thành một chữ một dòng (ảnh `project.png`), "Báo cáo ngày" bị gãy 2 dòng, thanh chọn khoảng thời gian ở Sắp tới bị cắt chữ "Quý", ô stat ở Nhật ký bị cắt "Xong trong th…", avatar hiện chữ "0" (ký tự đầu email) trông như một con số đếm.

---

## 2. Phát hiện (audit), theo mức

Hallmark chia 3 mức: **Floor** (không được vi phạm), **Reflex** (thói quen "máy làm", sửa hoặc ghi lý do), **Finish** (chi tiết hoàn thiện). Thêm mục **Lỗi** cho những thứ hỏng hẳn.

### 2.1 Lỗi (sửa ngay, ở mọi phương án)

| # | Ở đâu | Hiện tượng | Nguyên nhân |
|---|---|---|---|
| L1 | `src/components/ui.tsx:332-337` (`Screen` head), gọi từ `project/[id].tsx` | Tên project dài bị bẻ "Dự / án cá / nhân: / Web/ …" mỗi dòng 1-2 chữ; dòng phụ cũng bị ép hẹp | `head` là `flexDirection: row, flexWrap: wrap`; `headText` `flexShrink: 1` nên khi `right` (2 nút chữ "Đổi tên" + "Thêm việc") rộng, cột chữ co gần về 0 thay vì xuống dòng |
| L2 | `reports.tsx` (qua `Screen right`) | "Báo cáo ngày" gãy 2 dòng, "2 báo cáo, 2 nộp trễ" gãy 2 dòng | Cùng nguyên nhân L1 |
| L3 | `upcoming.tsx:91,230` | Segmented "3 ngày · 1 tuần · 2 tuần · 1 tháng · Quý" tràn, chữ "Quý" bị cắt ở mép | Control của web, trên điện thoại cho cuộn ngang nhưng không có dấu hiệu cuộn |
| L4 | `journal.tsx` + `components/Stat.tsx:18` | Nhãn stat bị cắt "Xong trong th…" | 4 ô stat chia đều 390pt, nhãn `numberOfLines={2}` |
| L5 | `ui.tsx:135-147` (`Avatar`) dùng ở Hôm nay | Avatar hiện "0" vì email bắt đầu bằng số, đặt cạnh nút tìm kiếm trông như badge đếm | Lấy ký tự đầu của email; không có fallback khi ký tự là số |

### 2.2 Floor

| Gate | Ở đâu | Phát hiện |
|---|---|---|
| Vùng chạm 44pt (truy cập) | `ui.tsx:121` `IconButton` mặc định `size=32`; `TaskRow.tsx:174-200` chip `#tag`, nút "6/6 ⌄", mũi tên dời việc (`hitSlop` 6-8) | Trên điện thoại vùng chạm thật < 44pt. Nút subtask "×" trong form sửa việc cũng nhỏ |
| 48, token | Ổn: màu và font đều đi qua `theme.ts`. Giữ nguyên quy tắc này cho mọi component mới | — |
| 9/67, nhãn chữ hoa giãn | Ổn: không có eyebrow, không có nhãn tracked caps | — |
| 8/46a, số liệu bịa | Ổn: mọi con số là dữ liệu thật | — |
| 27, giảm chuyển động | Ổn: `reducedMotion()` đã có; mọi animation mới (vuốt, sheet) phải đọc cờ này | — |

### 2.3 Reflex: dấu hiệu "web thu nhỏ"

| # | Ở đâu | Dấu hiệu | Trên mobile nên là |
|---|---|---|---|
| R1 | `ui.tsx:316-358` `Screen` | Mọi màn = H1 24px + sub + cụm nút chữ bên phải, rồi `ScrollView` padding 16. Đầu trang ăn ~180pt trước khi tới nội dung | Thanh đầu trang gọn: tiêu đề lớn cuộn đi, tối đa 2 nút **icon**, không bao giờ là nút chữ |
| R2 | `ui.tsx:240-252` `Card` dùng khắp nơi | Card trắng có viền + bo 14 + padding 24, xếp chồng: danh sách bị thu còn ~300pt; mỗi nhóm một card; Sắp tới có **7 card chỉ để nói "Trống"** | Danh sách **tràn mép** (edge-to-edge) hoặc *inset grouped* (bo góc, không viền, padding 0 ở hàng), phân nhóm bằng tiêu đề nhóm dính (sticky), ngày trống chỉ là một dòng mảnh |
| R3 | `index.tsx` + `Stat.tsx` | Hàng 3 ô stat "00 / 00 / 00" (đệm số 0, `Stat.tsx:15`) là trope dashboard; trên mobile `foot` bị ẩn (`Stat.tsx:20`) nên chỉ còn 3 con số trơ. Phần `aside` (7 ngày tới, việc kế tiếp, đã xong hôm nay) bị **bỏ hẳn** trên mobile | Một dòng tóm tắt trong đầu trang ("3 còn lại, 1 quá hạn, 2 đã xong") + dải 7 ngày cuộn ngang. Không đệm số 0 |
| R4 | `QuickAdd.tsx` dùng làm `footer` ở Hôm nay, Hộp thư, Sắp tới, Project, Nhật ký | Một ô input viền luôn nằm trên thanh tab: chiếm ~70pt cố định, nhìn như ô search của web, chồng lên nội dung khi mở gợi ý | Nút **+** nổi (FAB) ở vùng ngón cái mở **bottom sheet thêm nhanh** gắn trên bàn phím; chip cú pháp nằm thành hàng phụ kiện trên bàn phím |
| R5 | `task/[id].tsx` + `TaskForm.tsx` | Sửa việc = trang form web dài ~3 màn: label trên ô, toàn bộ nhãn hiện thành chip, Ưu tiên là 4 pill "Mức 1…", Lặp lại là **5 pill full-width xếp dọc** (`layout="stack"`), nút Lưu/Xoá ở tận đáy | **Sheet** chi tiết: tiêu đề sửa trực tiếp ở trên, các thuộc tính là **hàng** (Ngày › Lặp lại › Ưu tiên › Project › Nhãn ›), chạm vào hàng mở picker nhỏ; "Lưu" ở góc phải trên |
| R6 | `TaskRow.tsx:207-254` | Hàng việc chỉ có chạm → mở trang sửa. Dời ngày, xoá, đổi ưu tiên đều phải vào form; nút "Dời sang hôm nay" là nút chữ của web | **Vuốt phải = xong**, **vuốt trái = dời** (qua `move_tasks`), **nhấn giữ = menu** (dời, ưu tiên, project, xoá), haptic khi tick |
| R7 | `upcoming.tsx` | Segmented 5 khoảng thời gian + danh sách ngày cứng theo khoảng chọn | **Dải tuần** cuộn ngang (chạm để nhảy) + **agenda cuộn liên tục**; bỏ khái niệm "khoảng" trên mobile |
| R8 | `journal.tsx` | 4 ô stat + biểu đồ 30 cột + lịch tháng + ô ghi việc, mỗi thứ một card | Lịch/dải ngày ở trên, **dòng thời gian của ngày đang chọn** là nội dung chính; biểu đồ chuyển sang Thống kê |
| R9 | `projects.tsx:33` | Form "Project mới" (ô + nút full-width) nằm sẵn cuối danh sách trong một khối nền tô | Nút + trên đầu trang → sheet nhỏ đặt tên |
| R10 | `settings.tsx` | Cài đặt là chồng card web (Tài khoản, Ngôn ngữ, Mật khẩu…) với nút viền và nút đỏ "Đăng xuất" giữa trang | Danh sách nhóm kiểu Cài đặt hệ thống: hàng có icon, giá trị bên phải, chevron; "Đăng xuất" là hàng cuối màu đỏ |
| R11 | `ui.tsx:323-331` | Nút chữ "‹ Quay lại" trong nội dung thay vì header điều hướng | Header có nút back icon + vuốt cạnh để quay lại; dùng `router.back()` như cũ |
| R12 | `ui.tsx:277-309` `ConfirmModal` | Hộp thoại xác nhận ở giữa màn hình (desktop dialog) | **Action sheet** dưới đáy, nút huỷ to ở vùng ngón cái |
| R13 | Điều hướng | Cài đặt chỉ vào được bằng avatar ở Hôm nay; Thống kê chỉ từ nút ở Nhật ký; Báo cáo từ nudge ở Hôm nay; Tìm kiếm chỉ có ở Hôm nay & Hộp thư | Có một chỗ cố định cho các đích phụ (xem §4.1) |
| R14 | Toàn app | Mọi màn dùng `ScrollView` (không có `FlatList`/`SectionList`), không có pull-to-refresh | `SectionList` cho danh sách việc (ảo hoá, header nhóm dính) + `RefreshControl` |

### 2.4 Finish

- F6: số lớn dùng `tabular-nums` (đã có) — giữ.
- F15: trên mobile hiện có 3 kiểu nút chính cạnh nhau (primary đặc, outline, nút "danger" nền hồng). Mỗi màn chỉ một nút đặc.
- F26: tiêu đề và dòng phụ bị gãy với một chữ cuối dòng ở L1/L2.
- Subtask đã xong dài 10+ dòng gạch ngang trong form (`task3.png`): trên mobile cắt 2 dòng, chạm để mở.
- Tag chip trên hàng việc màu accent cùng màu với link: trên mobile dễ chạm nhầm khi muốn mở việc.

---

## 3. Hướng thiết kế mobile

**Ý tưởng:** *một tờ ngày cầm trong tay*. Trên web app là một bàn làm việc nhiều cột; trên điện thoại nó là **một danh sách duy nhất mà ngón cái làm hết mọi việc**. Nội dung tràn mép, thao tác bằng cử chỉ, mọi việc phụ (thêm, sửa, chọn ngày, xác nhận) nổi lên từ dưới bằng sheet, không chuyển trang.

**Signature (thứ người dùng nhớ):** hàng việc vuốt được. Vuốt phải, nền chuyển xanh "Xong", thả ra thì tick pop + rung nhẹ + hàng trượt vào nhật ký. Vuốt trái hiện "Ngày mai / Cuối tuần / Chọn ngày".

**Giữ nguyên (không đổi):**
- Tokens trong `src/constants/theme.ts`: màu, accent, bán kính, font. Không thêm hex mới ngoài `theme.ts`. Tông ấm (cream, góc mềm) như hiện tại.
- Mọi route, mọi RPC (`move_tasks`), `useRows`, logic ngày, cú pháp thêm nhanh, toast hoàn tác, i18n `tr()`.
- Layout web rộng (rail + top bar + panel): mọi thay đổi nằm sau nhánh `!wide`.

**Quy tắc mobile (áp cho mọi màn):**
1. Vùng chạm >= 44x44pt, kể cả chip và icon (dùng `hitSlop` khi phần nhìn thấy nhỏ hơn).
2. Hành động chính nằm ở **nửa dưới** màn hình (FAB, nút trong sheet); đầu trang chỉ có tiêu đề + tối đa 2 icon.
3. Không card lồng card, không card cho một dòng chữ. Danh sách là hàng tràn mép (nền `surface`, phân cách hairline thụt lề theo cột chữ) hoặc nhóm inset bo `radius.lg`, không viền.
4. Thêm, sửa, chọn, xác nhận = **bottom sheet**. Chuyển trang chỉ khi đi sâu vào một đối tượng (project, báo cáo một ngày).
5. Chuyển động là trạng thái: sheet trượt lên, hàng vuốt, không có hiệu ứng trang trí. Tôn trọng `reducedMotion()`.
6. Haptic: nhẹ khi tick / vượt ngưỡng vuốt / chọn trong picker; cảnh báo khi xoá.
7. Mọi vùng tải dữ liệu có 4 trạng thái: đang tải (skeleton đúng hình hàng), trống (một câu + một hành động), lỗi (đã có `showError`), đầy.

---

## 4. Thiết kế từng phần

### 4.1 Khung điều hướng

**Thanh tab: 4 tab + FAB**

```
┌──────────────────────────────────────┐
│                                      │
│                              ( + )   │  ← FAB 56pt, cách tab bar 16pt, accent
├──────────────────────────────────────┤
│  ☀       ▦        📖        ☰        │
│ Hôm nay Sắp tới  Nhật ký   Duyệt     │
└──────────────────────────────────────┘
```

- **Hôm nay · Sắp tới · Nhật ký · Duyệt.** "Hộp thư" và "Project" gộp vào tab **Duyệt** cùng Báo cáo, Thống kê, Cài đặt. Hộp thư là project mặc định nên ở chung chỗ với project là đúng mô hình.
- Badge quá hạn giữ trên tab Hôm nay.
- Tab bar: bỏ đường kẻ trên 2px (`rule.bar`), dùng hairline; nền `surface`; tab đang chọn có nền viên thuốc `primaryLight` sau icon (kiểu Material 3) thay vì chỉ đổi màu chữ.
- **Tuỳ chọn:** `NativeTabs` từ `expo-router/unstable-native-tabs` (có trong expo-router 58.0.30, có bản Android) cho tab bar Material thật. API còn `unstable`, nên làm **sau** khi giao diện ổn, trong một PR riêng; phương án mặc định là giữ `Tabs` JS hiện tại và chỉnh style.

**Màn Duyệt** (route mới `src/app/(tabs)/browse.tsx`, chỉ hiện trên mobile; web giữ rail như cũ):

```
Duyệt                          🔍
─────────────────────────────────
📥 Hộp thư                    3 ›
─────────────────────────────────
Project                         +
● Dự án cá nhân: Web/App…     0 ›
● HRM (HIS)                   0 ›
─────────────────────────────────
📄 Báo cáo ngày        2 nộp trễ ›
📊 Thống kê                     ›
⚙  Cài đặt                      ›
```

- Route `inbox`, `projects`, `reports`, `stats`, `settings` **giữ nguyên** (deep link, web rail vẫn dùng); trên mobile chúng được mở từ Duyệt với header có nút back.
- Avatar "0" ở Hôm nay bỏ đi (L5); Cài đặt nằm trong Duyệt.

**Header (`MobileHeader`, tách từ `Screen`)**
- Tiêu đề lớn 28/34 nằm đầu nội dung, `numberOfLines={2}`, **không bao giờ chung hàng với nút chữ** (sửa L1, L2).
- Khi cuộn qua tiêu đề lớn: thanh trên cùng hiện tiêu đề nhỏ 17pt + nền `background` + hairline (Animated theo `scrollY`, giữ đơn giản, chỉ opacity).
- Bên phải tối đa 2 `IconButton` 44pt (tìm kiếm, thêm/sửa). Nút chữ như "Đổi tên", "Thống kê", "Viết báo cáo hôm nay" chuyển vào menu `⋯` hoặc thành icon.
- Màn con có nút back icon `chevron-back` ở bên trái header (bỏ nút chữ "Quay lại" trong nội dung).

### 4.2 Hàng việc (`TaskRow`, phiên bản mobile)

```
┌─────────────────────────────────────────┐
│ ◯  API export word/pdf file Payslip      │  ← tiêu đề 16, tối đa 2 dòng
│    cho nhiều nhân viên                   │
│    ⚠ Trễ 3 ngày   📁 HRM (HIS)   ☑ 2/5   │  ← meta 13, 1 dòng, cắt cuối
└─────────────────────────────────────────┘
   hairline thụt lề bắt đầu từ cột chữ (bằng tick 28 + gap 12 + lề 16)
```

- Tràn mép, nền `surface`, padding dọc 12, cao tối thiểu 56pt.
- Tag `#nhãn` trên hàng: chữ `muted`, không phải link màu accent (tránh chạm nhầm); lọc theo nhãn đi qua Tìm kiếm.
- Nút "6/6 ⌄" mở subtask giữ, nhưng vùng chạm 44pt.
- **Cử chỉ** (`react-native-gesture-handler` `ReanimatedSwipeable`):
  - Vuốt phải qua ngưỡng 30% → nền `success`, icon ✓ → thả = tick (gọi đúng hàm tick hiện có trong `TaskRow.tsx:136`).
  - Vuốt trái → lộ 2 nút: "Mai" (dời +1 ngày) và "Dời…" (mở sheet chọn ngày). Đều qua `move_tasks` + toast hoàn tác như hiện tại.
  - Nhấn giữ → action sheet: Dời sang hôm nay / ngày mai / chọn ngày · Ưu tiên · Chuyển project · Xoá (xác nhận).
- Haptic: `selectionAsync` khi vượt ngưỡng vuốt, `impactAsync(Light)` khi tick, `notificationAsync(Warning)` trước khi xoá.
- Danh sách: `SectionList` (header nhóm dính: "Quá hạn 1", "Hôm nay"), `RefreshControl` gọi lại `useRows`.

### 4.3 Thêm nhanh (FAB + sheet)

```
┌─────────────────────────────────────┐
│ ─────                               │  ← grabber
│ mai 9h !1 #hrm Gửi báo cáo lương█   │  ← TextInput 17pt, autoFocus, không viền
│ 📅 Thứ Năm, 12/11  ⏰ 9:00  !1  #hrm │  ← chip đã nhận diện (đọc từ quick.ts)
├─────────────────────────────────────┤
│ [mai] [9h] [!1] [#] [📁 Hộp thư]  ➤ │  ← hàng phụ kiện ngay trên bàn phím
└─────────────────────────────────────┘
          ⌨ bàn phím
```

- FAB 56pt ở mọi tab trừ Duyệt. Chạm → sheet bật lên cùng bàn phím.
- `defaults` theo màn giữ nguyên logic hiện tại (Hôm nay → hạn hôm nay; Sắp tới → ngày đang chọn; project → project đó; Nhật ký → ghi việc đã làm).
- Hàng phụ kiện dùng chính `EXAMPLES` trong `quick.ts` (quy tắc CLAUDE.md: token mới phải thêm vào `EXAMPLES`).
- Gửi: nút ➤ hoặc Enter; sheet **giữ mở** để thêm việc tiếp, vuốt xuống để đóng.
- Bỏ `footer={<QuickAdd …/>}` trên mobile; `QuickAdd` vẫn dùng nguyên cho web (top bar).

### 4.4 Chi tiết việc (sheet)

`task/[id]` đổi thành modal sheet trên native: `Stack.Screen name="task/[id]"` với `presentation: 'formSheet'`, `sheetAllowedDetents: [0.6, 1]`, `sheetGrabberVisible: true`, `sheetCornerRadius: radius.lg` (react-native-screens 4.30 hỗ trợ Android, cần thử với bàn phím). Web giữ panel phải như cũ.

```
 ─────
 Huỷ                 Sửa việc            Lưu
 ◯  Update chức năng giao diện ngày 10/11   ← tiêu đề sửa trực tiếp, 20pt
    Thêm ghi chú…                            ← ghi chú, rich text như hiện tại
 ───────────────────────────────────────
 📅 Ngày          Thứ Năm 12/11, 9:00     ›
 🔁 Lặp lại                    Không lặp  ›
 🚩 Ưu tiên                     Bình thường ›
 📁 Project                       Hộp thư  ›
 #  Nhãn                    #dựáncánhân   ›
 ───────────────────────────────────────
 Việc con                              6/6
 ✓ PR #16: Ngày và giờ có lịch và bộ…     ← 2 dòng, chạm để mở rộng
 ✓ PR #20: docs: thêm README…
 + Thêm việc con
 ───────────────────────────────────────
 🗑 Xoá việc                               ← hàng đỏ cuối, xác nhận bằng action sheet
```

- Mỗi hàng thuộc tính mở một **picker sheet** nhỏ:
  - Ngày: lịch tháng (`MonthCalendar` có sẵn) + chip nhanh "Hôm nay / Mai / Cuối tuần / Tuần sau" + giờ (`DateTime`).
  - Lặp lại: danh sách radio 5 dòng (thay 5 pill full-width), "Hằng tuần" mở chọn thứ.
  - Ưu tiên: 4 hàng có cờ màu `priority[1..4]`.
  - Project / Nhãn: danh sách có ô tìm ở trên, chọn nhiều cho nhãn.
- "Lưu" ở header (giữ hành vi lưu tường minh như `TaskForm` hiện tại). Không đổi validate, không đổi API.
- Cách làm: tách `TaskForm` thành phần dữ liệu (state + save/remove, giữ nguyên) và phần hiển thị (`TaskFormWide` = form hiện tại, `TaskSheet` = bản hàng thuộc tính). Logic không di chuyển ra khỏi component đang sở hữu nó.

### 4.5 Từng màn

**Hôm nay**
```
Hôm nay                        🔍
Thứ Tư 11/11, 3 còn lại, 1 quá hạn, 2 xong     ← một dòng, không ô stat (dấu phẩy, không dùng "·" làm dấu nối: gate 63)
[T5 12] [T6 13] [T7 14] [CN 15] [T2 16] [T3 17] [T4 18]   ← dải 7 ngày, số việc mỗi ngày, chạm → Sắp tới đúng ngày
┌ Báo cáo ngày: hạn 21:00 tối nay      Viết › ┐  ← một hàng, không phải card có nút to
Quá hạn 1                      Dời hết sang hôm nay
◯ API export word/pdf …
Hôm nay
◯ …
Đã xong hôm nay 2  ⌄                            ← thu gọn, chạm để mở (thay aside "Đã xong hôm nay")
                                       ( + )
```
- Bỏ `StatRow` trên mobile; dữ liệu `due/over/done` đã tính sẵn đưa vào dòng phụ.
- Dải 7 ngày + "Đã xong hôm nay" lấy lại thông tin của `aside` web mà mobile đang mất.
- "Dời hết sang hôm nay" là nút chữ nhỏ trong header nhóm (ngoài ra vuốt từng hàng).

**Sắp tới**
- Dải tuần dính trên cùng (cuộn ngang theo tuần, ngày chọn có nền `primaryLight`, chấm số việc).
- Bên dưới: agenda cuộn liên tục 30 ngày (`SectionList`, mỗi ngày một section). Ngày trống = một dòng tiêu đề mờ "T7, 14/11: trống" cao 32pt, **không có card**.
- Cuộn agenda thì dải tuần đi theo; chạm ngày trên dải thì `scrollToLocation`.
- Bỏ segmented 5 khoảng trên mobile (L3). Web giữ.

**Nhật ký**
- Đầu trang: tháng + `⋯` (Thống kê). Dải tuần/lịch tháng thu gọn được (mặc định là dải tuần, kéo xuống mở lịch tháng: dùng `MonthCalendar` hiện có).
- Nội dung chính: dòng thời gian việc đã xong của **ngày đang chọn** (giờ tick bên trái, tên việc, project).
- 4 ô stat + biểu đồ 30 ngày chuyển sang Thống kê (L4 tự hết).
- Ghi việc đã làm: FAB với `defaults` "đã xong" như footer hiện tại.

**Duyệt → Project chi tiết**
- Header: tên project 2 dòng tối đa (L1), dòng phụ "0 mở, 1 xong tuần này", bên phải `⋯` (Đổi tên, Xoá project).
- Danh sách việc như Hôm nay; "Đã xong" thu gọn.
- "Xoá project" ra khỏi thân trang, vào menu `⋯` + action sheet xác nhận.

**Duyệt → Báo cáo ngày**
- Tiêu đề không chung hàng với nút (L2); "Viết báo cáo hôm nay" thành FAB (icon bút) trên màn này.
- Mỗi báo cáo là hàng: ngày, badge "Nộp trễ", 1 dòng tóm tắt (thay vì 2).
- Màn viết báo cáo (`report/[day]`): editor DOM chiếm toàn màn, toolbar định dạng nằm trên bàn phím; nút Lưu ở header.

**Duyệt → Thống kê**
- Segmented Tuần/Tháng + mũi tên ‹ › gộp thành một hàng: "‹ Tuần 09/11 – 15/11 ›", vuốt ngang biểu đồ để đổi kỳ.
- 4 số liệu thành lưới 2x2 (đủ chỗ cho nhãn, hết cắt chữ).

**Tìm kiếm**
- Ô tìm trong header (cao 44, nền `secondary`, không viền), autoFocus giữ như hiện tại. Chip nhãn cuộn ngang 1 hàng thay vì lưới 3 hàng.

**Cài đặt**
- Danh sách nhóm: Tài khoản (email, Google đã liên kết ›, Đổi mật khẩu ›), Giao diện (Ngôn ngữ ›, Màu nhấn ›, Sáng/Tối ›), cuối cùng "Đăng xuất" (hàng chữ đỏ).
- Mỗi lựa chọn mở picker sheet; vẫn reload app khi đổi ngôn ngữ/accent như hiện tại (`prefs.ts`).

**Đăng nhập**
- Bỏ card trắng có viền bao form trên mobile (card trong nền là mẫu web): form nằm thẳng trên nền, logo + tiêu đề ở 1/3 trên, nút "Đăng nhập" và "Tiếp tục với Google" ở nửa dưới.
- `keyboardType="email-address"`, `textContentType`/`autoComplete` cho email/mật khẩu để autofill của Android/iOS hoạt động (kiểm tra lại trong `sign-in.tsx`).

**Toast và xác nhận**
- Toast mobile ở **đáy**, trên FAB/tab bar (không ở đỉnh, nơi bị thông báo hệ thống che như `task2.png`), vuốt ngang để tắt.
- `ConfirmModal` trên mobile thành action sheet (R12); web giữ dialog.

---

## 5. Component và file

| Việc | File | Ghi chú |
|---|---|---|
| Sửa L1, L2 ngay | `src/components/ui.tsx` (`Screen` head) | Trên narrow: `right` xuống hàng riêng hoặc chỉ nhận icon; `headText` `flexBasis: '100%'` khi narrow |
| `MobileHeader` | `src/components/ui.tsx` | Tiêu đề lớn + thanh thu gọn khi cuộn, back icon, tối đa 2 icon |
| `Sheet` | `src/components/Sheet.tsx` (mới) | Một bottom sheet dùng chung (Modal + Animated + gesture kéo xuống), dùng cho thêm nhanh, picker, action sheet. Không thêm thư viện sheet |
| `ActionSheet` | trong `Sheet.tsx` | Thay `ConfirmModal`/`confirmAction` khi `!wide` |
| `SwipeRow` | `src/components/TaskRow.tsx` | Bọc `TaskRow` khi `!wide`; gọi lại hàm tick / `moveTasks` có sẵn |
| `Fab` | `src/components/ui.tsx` | 56pt, `color.primary`, `boxShadow` dùng `shadowModal` |
| `QuickAddSheet` | `src/components/QuickAdd.tsx` | Dùng chung parser và chip; `QuickAdd` cũ giữ cho web |
| `TaskSheet` | `src/components/TaskForm.tsx` | Tách hiển thị, giữ state/save/remove |
| `WeekStrip` | `src/components/WeekStrip.tsx` (mới) | Dùng ở Hôm nay, Sắp tới, Nhật ký |
| Màn Duyệt | `src/app/(tabs)/browse.tsx` (mới) | Ẩn khỏi rail web |
| Tab bar | `src/app/(tabs)/_layout.tsx` | 4 tab, ẩn `inbox`/`projects` khỏi tab bar (giữ route) |
| Task sheet | `src/app/_layout.tsx` | `presentation: 'formSheet'` cho `task/[id]` trên native |
| Toast vị trí | `src/components/Notifier.tsx` | Đáy trên mobile |
| Avatar | `src/components/ui.tsx:135` | Bỏ khỏi Hôm nay mobile; nếu giữ ở nơi khác, ký tự số → icon `person` |

**Phụ thuộc mới** (cài bằng `npx expo install`, cần **build lại dev build** vì có native code):
- `expo-haptics` (bản bundled ~58.0.7).
- `react-native-gesture-handler` (~3.3 theo SDK, hiện có 3.4.0 kéo theo expo-router) và `react-native-reanimated` (4.7.1) khai báo **trực tiếp** trong `package.json`; bọc root bằng `GestureHandlerRootView`.
- Không thêm thư viện bottom sheet; không cần `@expo/ui` cho phạm vi này.

**i18n:** mọi chuỗi mới ("Duyệt", "Mai", "Dời…", "Trống", "Đã xong hôm nay"…) qua `tr()` và có bản tiếng Anh trong `en` (`npm test` sẽ bắt thiếu).

---

## 6. Lộ trình

Mỗi giai đoạn là một PR riêng, web rộng không đổi sau mỗi PR (chụp lại 1440 để so).

| Giai đoạn | Nội dung | Xong khi |
|---|---|---|
| **0. Sửa lỗi** | L1-L5, vùng chạm 44pt (`IconButton` mặc định 44 trên narrow, `hitSlop` cho chip/nút trong hàng) | Ảnh project/báo cáo/thống kê/nhật ký không còn chữ gãy hay bị cắt |
| **1. Khung** | `MobileHeader`, 4 tab + Duyệt, toast ở đáy, bỏ nút chữ "Quay lại" | Mọi màn có header gọn, mọi đích phụ vào được trong ≤ 2 chạm |
| **2. Danh sách** | `TaskRow` tràn mép, `SectionList` + pull-to-refresh, bỏ card bao danh sách, Sắp tới agenda + `WeekStrip`, Hôm nay bỏ stat row | Không còn card "Trống"; danh sách 50 việc cuộn mượt trên S23 |
| **3. Thêm nhanh** | `Sheet`, `Fab`, `QuickAddSheet`, bỏ footer input trên mobile | Thêm 3 việc liên tiếp không phải đóng/mở lại; chip cú pháp đúng như web |
| **4. Cử chỉ** | gesture-handler + reanimated + haptics (rebuild dev build), `SwipeRow`, nhấn giữ → action sheet | Tick, dời, xoá đều làm được không cần mở việc; hoàn tác vẫn chạy |
| **5. Chi tiết việc** | `task/[id]` formSheet, `TaskSheet` + các picker | Sửa ngày/ưu tiên/project trong ≤ 3 chạm; lưu giống hệt trước |
| **6. Nhật ký, Thống kê, Cài đặt, Đăng nhập** | Theo §4.5 | Nhật ký mở ra là dòng thời gian của hôm nay |
| **7. (tuỳ chọn) NativeTabs** | Thử `expo-router/unstable-native-tabs` cho Android Material tab bar | Chỉ merge nếu badge + ẩn tab + FAB hoạt động ổn |

**Kiểm tra mỗi PR:**
1. `npm run lint && npm run typecheck && npm test`.
2. Chụp lại đúng các màn trong `.hallmark/before-mobile/` qua adb (`adb exec-out screencap -p`, deep link `taskapp:///<route>`) và đặt cạnh ảnh cũ.
3. Thử theme tối + accent khác (màu từ token, không hardcode).
4. Bật "Xoá hiệu ứng động" trong Android: vuốt và sheet vẫn dùng được, không trượt.
5. Mở web 1440: layout rộng không đổi.

---

## 7. Ngoài phạm vi, rủi ro

- **Không đổi:** schema DB, RPC, logic ngày/nhật ký/báo cáo, nội dung chữ (trừ các nút chuyển thành icon/menu), tông màu.
- **Rủi ro:** `formSheet` trên Android với bàn phím và editor DOM (`RichEditor`, `'use dom'`) cần thử sớm; nếu lỗi, dùng `Sheet` tự viết cho chi tiết việc. `NativeTabs` còn `unstable`, nên để cuối.
- **Đã bỏ qua trong audit:** theme tối, iOS (chưa có máy), màn đặt lại mật khẩu. Nên chụp thêm trước giai đoạn 6.
- **Cần thêm từ bạn:** một tài khoản/ngày có ~15 việc thật (có quá hạn, subtask, lặp lại) để chụp "before/after" của Hôm nay và Sắp tới khi có dữ liệu; ảnh hiện tại phần lớn là trạng thái trống.

---

## 8. Tiến độ thực tế (2026-11-12)

Làm trong một nhánh `feat/mobile-native-redesign`, kiểm trên Galaxy S23 (SM-S911N, Android 17, 1080x2340, density 450) qua adb Wi-Fi, bản `assembleDebug` + Metro (`adb reverse tcp:8081`). Ảnh sau: `.hallmark/after-mobile/`, so sánh: `.hallmark/compare-mobile.html`.

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| 0. Sửa lỗi L1-L5, vùng chạm 44 | Xong | `Screen` mobile không còn nút chữ trong head; Sắp tới bỏ segmented; Stat 2x2; Avatar số → icon; `IconButton`/`Choices`/chip có `hitSlop`, `Button` 44 trên phone |
| 1. Khung | Xong | `MobileScreen` (tiêu đề lớn + thanh thu gọn, back icon, tối đa 2 icon + ⋯), 4 tab tự vẽ (pill M3, badge), màn `browse`, toast ở đáy vuốt để tắt |
| 2. Danh sách | Xong, khác plan | Nhóm inset không viền, hairline từ cột chữ, pull-to-refresh, Sắp tới agenda 30 ngày + `WeekStrip` dính. **Không** dùng `SectionList`: danh sách cá nhân nhỏ, `ScrollView` đủ; thêm khi > vài trăm hàng |
| 3. Thêm nhanh | Xong | `Sheet` tự viết (Modal + Animated + kéo xuống), `Fab`, `AddFab` giữ mở để thêm liên tiếp, chip cú pháp từ `EXAMPLES` |
| 4. Cử chỉ | Xong, khác plan | Vuốt phải = xong, vuốt trái = Mai / Dời…, nhấn giữ = action sheet (`choose()` trong `notify.ts`), haptic qua `expo-haptics`. Dùng `PanResponder` + `Animated` có sẵn thay vì gesture-handler/reanimated (ít native dep hơn) |
| 5. Chi tiết việc | Xong, khác plan | `task/[id]` = modal `slide_from_bottom` toàn màn (không `formSheet` detents) + `TaskSheet` dạng hàng thuộc tính, picker sheet; logic lưu giữ trong `TaskForm` |
| 6. Nhật ký, Thống kê, Cài đặt, Đăng nhập | Xong | Nhật ký: dải ngày tháng (gập ra lịch), timeline ngày chọn, stat/biểu đồ sang Thống kê; Cài đặt: danh sách nhóm + sheet; Đăng nhập bỏ card |
| 7. NativeTabs | Chưa làm | Tuỳ chọn, để PR riêng |

Lỗi phát hiện trên máy thật và đã sửa: pill tab bị vuông sau khi đổi tab (Android mất bo góc khi gán nền sau), bàn phím không bật với `autoFocus` trong Modal (focus qua ref ở `onShow`), khoảng đệm thanh điều hướng thừa khi bàn phím mở, separator hàng cuối lộ ra, nhãn `#tag` không có màu (đen trên nền tối), cờ ưu tiên trong menu cùng một màu, 30 dòng "Trống" khi Sắp tới rỗng, dải ngày Nhật ký hiện ngày tương lai.

Chưa kiểm được: web rộng 1440 khi đã đăng nhập (không có mật khẩu trên máy này; nhánh `wide` giữ nguyên code), "Xoá hiệu ứng động" của Android (không đổi cài đặt máy của người dùng), iOS.
