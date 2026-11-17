// KEYWORD-MORE-SHEET (피그마 최종 디자인): '+ 키워드 더보기'로 여는 '키워드 추가' 바텀시트
// 지금 선택한 키워드와 함께 등장한 키워드를 고르면, 함께 포함된 기록 수를 미리 보여주고 적용한다.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { KeywordFacet } from '../api/types';
import { useRecordKeywords } from '../hooks/queries';
import { colors, space, typography } from '../theme/tokens';
import { KeywordChip } from './KeywordChips';
import { Button, Icon, SearchBar } from './ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 지금 화면에서 선택된 키워드 */
  selectedIds: string[];
  nameOf: (id: string) => string;
  /** 지금 선택과 함께 등장한 키워드 (개수 포함) */
  candidates: KeywordFacet[];
  onApply: (ids: string[]) => void;
};

export function KeywordAddSheet(props: Props) {
  // 열 때마다 새로 시작
  return props.visible ? <SheetBody {...props} /> : null;
}

function SheetBody({ onClose, selectedIds, nameOf, candidates, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  // base: 이미 선택된 키워드(✕로 뺄 수 있음, 최소 1개 유지) / picked: 시트에서 새로 고른 키워드
  const [base, setBase] = useState<string[]>(selectedIds);
  const [picked, setPicked] = useState<string[]>([]);
  const next = useMemo(() => [...base, ...picked], [base, picked]);
  const changed = picked.length > 0 || base.length !== selectedIds.length;
  // 고른 조합으로 몇 개 기록이 남는지 미리 조회
  const preview = useRecordKeywords({ keywordIds: next });
  const count = preview.data?.matchedCount;

  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return t ? candidates.filter((k) => k.name.toLowerCase().includes(t)) : candidates;
  }, [candidates, text]);
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: 48 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={typography.subtitle18Semibold}>키워드 추가</Text>
            <Pressable hitSlop={12} onPress={onClose} accessibilityRole="button" accessibilityLabel="키워드 추가 닫기">
              <Icon source={require('../../assets/icons/close-sheet.svg')} width={24} height={24} />
            </Pressable>
          </View>
          <SearchBar value={text} onChangeText={setText} placeholder="키워드 검색" />
          <View style={styles.wrap}>
            {base.map((id) => (
              <KeywordChip
                key={id}
                kind="selected"
                label={nameOf(id)}
                removable={next.length > 1}
                onPress={next.length > 1 ? () => setBase((l) => l.filter((x) => x !== id)) : undefined}
              />
            ))}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
            {shown.map((k) => (
              <KeywordChip
                key={k.keywordId}
                kind={picked.includes(k.keywordId) ? 'selected' : 'selectable'}
                label={k.name}
                count={k.recordCount}
                onPress={() => toggle(k.keywordId)}
              />
            ))}
          </ScrollView>
          <Button
            title={count != null ? `${count}개 기록 보기` : '기록 보기'}
            disabled={!changed}
            loading={preview.isFetching && changed}
            onPress={() => { onApply(next); onClose(); }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13,29,40,0.5)' },
  sheet: { height: '75%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: space.md, paddingHorizontal: space.lg, gap: space.lg },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
