import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiDef } from '@/types/task';

interface Props {
  value: ShojikubaiDef | null;
  onSave: (def: ShojikubaiDef) => void;
}

const FIELDS: { key: keyof ShojikubaiDef; label: string; placeholder: string }[] = [
  { key: 'ume', label: '梅', placeholder: '1秒でできる最低限' },
  { key: 'take', label: '竹', placeholder: 'いつも通りの基準' },
  { key: 'matsu', label: '松', placeholder: '目指さなくてOKな理想' },
];

export function ShojikubaiEditor({ value, onSave }: Props) {
  const { fs } = useLayout();
  const [ume, setUme] = useState(value?.ume ?? '');
  const [take, setTake] = useState(value?.take ?? '');
  const [matsu, setMatsu] = useState(value?.matsu ?? '');

  const vals: Record<keyof ShojikubaiDef, string> = { ume, take, matsu };
  const setters: Record<keyof ShojikubaiDef, (v: string) => void> = {
    ume: setUme,
    take: setTake,
    matsu: setMatsu,
  };

  const commit = () => {
    const def: ShojikubaiDef = { ume, take, matsu };
    if (ume || take || matsu) onSave(def);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.hint, { fontSize: fs.caption }]}>各レベルの行動を書くと完了後に選べます</Text>
      {FIELDS.map(({ key, label, placeholder }) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.label, { fontSize: fs.caption }]}>{label}</Text>
          <TextInput
            style={[styles.input, { fontSize: fs.caption }]}
            value={vals[key]}
            onChangeText={setters[key]}
            onBlur={commit}
            onSubmitEditing={commit}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(91,141,239,0.07)',
  },
  hint: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.blue,
    fontWeight: '700',
    width: 24,
  },
  input: {
    flex: 1,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(91,141,239,0.3)',
    paddingVertical: 3,
  },
});
