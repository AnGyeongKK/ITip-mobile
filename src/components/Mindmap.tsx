// RESULT-MINDMAP (피그마 '디자인 확정 화면' 11/11): 위에서 아래로 내려가는 트리
// 핵심 주제(rootTitle) → mindmap.sectionIds 순서의 주제 카드(▶시간) → 각 주제의 subtopics
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Analysis } from '../api/types';
import { formatMs } from '../lib/format';
import { colors, palette, radius, space, typography } from '../theme/tokens';
import { TimeTag } from './ui';

type Props = { analysis: Analysis; onPressSection: (sectionId: string) => void };

const LINE_MAIN = palette.neutral[70]; // 줄기
const LINE_SUB = palette.neutral[80]; // 세부 주제 가지
const STROKE = 1.4;
const BRANCH_Y = 26.6; // 주제 카드 가운데 높이
const SUB_ROW = 34.4; // 세부 주제 한 줄 (본문 22.4 + 간격 12)

export function Mindmap({ analysis, onPressSection }: Props) {
  const sections = useMemo(
    () => analysis.mindmap.sectionIds
      .map((id) => analysis.sections.find((s) => s.sectionId === id))
      .filter((s): s is Analysis['sections'][number] => !!s),
    [analysis],
  );
  // 주제가 많으면 3번째부터 세부 주제를 접어 둔다
  const [closed, setClosed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.sectionId, sections.length > 5 && i > 1])));

  return (
    <View>
      <View style={styles.root}>
        <Text style={[typography.body14Semibold, { color: colors.onPrimary }]}>핵심 주제</Text>
        <Text style={[typography.heading18, { color: colors.onPrimary }]}>{analysis.mindmap.rootTitle}</Text>
      </View>
      <View style={styles.trunk}>
        {sections.map((s, i) => {
          const isClosed = closed[s.sectionId];
          const last = i === sections.length - 1;
          return (
            <View key={s.sectionId} style={styles.branch}>
              {/* 줄기: 마지막 주제는 카드 가운데까지만 */}
              <View style={[styles.vline, last ? { height: BRANCH_Y + 21, bottom: undefined } : null]} />
              <View style={styles.hline} />
              <Pressable
                onPress={() => onPressSection(s.sectionId)}
                onLongPress={() => setClosed((c) => ({ ...c, [s.sectionId]: !c[s.sectionId] }))}
                style={({ pressed }) => [styles.node, pressed && { opacity: 0.7 }]}
                accessibilityHint="누르면 구간 상세로 이동, 길게 누르면 세부 주제를 접거나 펼쳐요"
              >
                <Text style={[typography.subtitle16Bold, styles.nodeTitle]} numberOfLines={2}>{s.title}</Text>
                <TimeTag label={formatMs(s.startMs)} onTint />
              </Pressable>
              {s.subtopics.length ? (
                isClosed ? (
                  <Pressable onPress={() => setClosed((c) => ({ ...c, [s.sectionId]: false }))} style={styles.more}>
                    <Text style={[typography.caption12, { color: colors.textBody }]}>세부 주제 {s.subtopics.length}개 보기</Text>
                  </Pressable>
                ) : (
                  <View style={styles.subs}>
                    <View style={[styles.subLine, { height: 13 + SUB_ROW * (s.subtopics.length - 0.5) }]} />
                    {s.subtopics.map((t, j) => (
                      <View key={`${t}-${j}`} style={styles.subRow}>
                        <View style={styles.subTick} />
                        <Text style={[typography.body14Medium, styles.subText]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: space.lg, backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: space.lg },
  trunk: { marginLeft: 32, marginRight: space.lg },
  branch: { paddingTop: 21, paddingLeft: 16 },
  vline: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, backgroundColor: LINE_MAIN },
  hline: { position: 'absolute', left: 0, top: 21 + BRANCH_Y, width: 21, height: STROKE, backgroundColor: LINE_MAIN },
  node: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.md, borderWidth: STROKE, borderColor: colors.border, backgroundColor: colors.surface },
  nodeTitle: { flex: 1, color: colors.primaryDark },
  subs: { marginLeft: 15, paddingTop: 13 },
  subLine: { position: 'absolute', left: 0, top: 0, width: STROKE, backgroundColor: LINE_SUB },
  subRow: { flexDirection: 'row', alignItems: 'center', minHeight: SUB_ROW },
  subTick: { width: 21, height: STROKE, backgroundColor: LINE_SUB, marginLeft: 1 },
  subText: { flex: 1, marginLeft: space.sm, color: colors.textBody },
  more: { marginLeft: 15, paddingTop: space.md, paddingBottom: space.xs },
});
