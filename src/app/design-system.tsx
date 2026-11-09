import { Redirect } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Choices, ConfirmModal, Empty, Field, ListRow, Meta, Tick } from '@/components/ui';
import { color, priority, text } from '@/constants/theme';

// Dev-only screen to compare the RN components with docs/design/design-system.html.
export default function DesignSystem() {
  const [p, setP] = useState<1 | 2 | 3 | 4>(1);
  const [days, setDays] = useState<number[]>([1, 3]);
  const [repeat, setRepeat] = useState('daily');
  const [done, setDone] = useState(false);
  const [modal, setModal] = useState(false);
  if (!__DEV__) return <Redirect href="/sign-in" />;

  return (
    <SafeAreaView style={s.fill}>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.h1}>Design system</Text>

        <Section title="Nút">
          <View style={s.wrap}>
            <Button title="Viền" />
            <Button title="Chính" variant="primary" />
            <Button title="Phụ" variant="secondary" />
            <Button title="Mờ" variant="ghost" />
            <Button title="Xoá" variant="danger" />
            <Button title="Khoá" variant="primary" disabled />
            <Button title="Đang lưu" variant="primary" loading />
          </View>
        </Section>

        <Section title="Badge">
          <View style={s.wrap}>
            <Badge label="Nháp" />
            <Badge label="Xong" tone="success" />
            <Badge label="Quá hạn" tone="warning" />
            <Badge label="Lỗi" tone="error" />
          </View>
        </Section>

        <Section title="Ô nhập">
          <Field label="Tên việc" placeholder="Ví dụ: Gọi điện cho mẹ" />
          <Field label="Hạn" placeholder="DD/MM" error="Ngày không hợp lệ" defaultValue="31/02" />
          <Field label="Giờ" placeholder="HH:MM" editable={false} />
          <Field label="Hạn" defaultValue="05/12" right={<Button title="Bỏ hạn" variant="ghost" />} />
        </Section>

        <Section title="Ô tick">
          <View style={s.wrap}>
            {([1, 2, 3, 4] as const).map((n) => <Tick key={n} priority={n} />)}
            <Tick priority={1} checked />
            <Tick priority={3} disabled />
          </View>
        </Section>

        <Section title="Nhóm nút chọn">
          <Choices layout="cols" value={p} onChange={setP} options={([1, 2, 3, 4] as const).map((n) => ({ value: n, label: `Mức ${n}`, dot: priority[n] }))} />
          <Choices layout="stack" value={repeat} onChange={setRepeat} options={[
            { value: 'daily', label: 'Hằng ngày' },
            { value: 'weekly', label: 'Hằng tuần' },
            { value: 'monthly', label: 'Hằng tháng' },
            { value: 'every', label: 'Mỗi N ngày' },
          ]} />
          <Choices
            layout="days"
            value={days}
            onChange={(d) => setDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]))}
            options={['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label, value) => ({ value, label }))}
            error={days.length ? undefined : 'Chọn ít nhất một ngày'}
          />
          <Choices value={null} onChange={() => {}} disabled options={[{ value: 'x', label: 'Khoá' }]} />
        </Section>

        <Card title="Hôm nay" flush action={<Button title="Thêm" variant="ghost" />}>
          <ListRow title="Nộp báo cáo tháng" left={<Tick priority={1} />} meta={<Meta tone="over">Hôm qua</Meta>} />
          <ListRow title="Tập thể dục" left={<Tick priority={2} />} meta={<><Meta tone="today">Hôm nay 07:00</Meta><Meta>↻ Hằng ngày</Meta></>} />
          <ListRow title="Đọc sách" left={<Tick priority={3} checked={done} onPress={() => setDone(!done)} />} done={done} meta={<Meta>Nhà</Meta>} />
          <ListRow title="Mua sữa" left={<Tick />} />
        </Card>

        <Section title="Hộp xác nhận">
          <Button title="Xoá project" variant="danger" onPress={() => setModal(true)} />
          <ConfirmModal
            visible={modal}
            title="Xoá project “Nhà”?"
            message="Các việc trong project sẽ chuyển về Hộp thư."
            confirmText="Xoá project"
            onCancel={() => setModal(false)}
            onConfirm={() => setModal(false)}
          />
        </Section>

        <Card title="Trống">
          <Empty>Không có việc nào hôm nay.</Empty>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card title={title}><View style={s.stack}>{children}</View></Card>;
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.background },
  page: { padding: 16, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { ...text.xl, color: color.foreground },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  stack: { gap: 16 },
});
