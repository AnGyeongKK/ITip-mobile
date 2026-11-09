// RESULT-MINDMAP (피그마 11/06): 위에서 아래로 내려가는 트리
// rootTitle → mindmap.sectionIds 순서의 주제 카드(시간 · ›) → 각 주제의 subtopics
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Analysis } from '../api/types';
import { formatMs } from '../lib/format';
import { colors, font, radius, space } from '../theme/tokens';

type Props = { analysis: Analysis; onPressSection: (sectionId: string) => void };

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
      <Text style={[font.caption, { marginBottom: space.md }]}>주제를 선택해 구간 상세에서 확인해요</Text>
      <View style={styles.root}><Text style={font.h3}>{analysis.mindmap.rootTitle}</Text></View>
      <View style={styles.trunk}>
        {sections.map((s, i) => {
          const isClosed = closed[s.sectionId];
          const last = i === sections.length - 1;
          return (
            <View key={s.sectionId} style={styles.branch}>
              {/* 세로 줄: 마지막 주제는 카드 가운데까지만 */}
              <View style={[styles.vline, last ? { height: 44, bottom: undefined } : null]} />
              <View style={styles.hline} />
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={() => onPressSection(s.sectionId)}
                  onLongPress={() => setClosed((c) => ({ ...c, [s.sectionId]: !c[s.sectionId] }))}
                  style={({ pressed }) => [styles.node, pressed && { opacity: 0.7 }]}
                  accessibilityHint="누르면 구간 상세로 이동, 길게 누르면 세부 주제를 접거나 펼쳐요"
                >
                  <Text style={styles.nodeTitle} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.nodeTime}>{formatMs(s.startMs)}</Text>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
                {s.subtopics.length ? (
                  isClosed ? (
                    <Pressable onPress={() => setClosed((c) => ({ ...c, [s.sectionId]: false }))} style={styles.more}>
                      <Text style={font.caption}>세부 주제 {s.subtopics.length}개 보기</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.subs}>
                      {s.subtopics.map((t, j) => (
                        <View key={`${t}-${j}`} style={styles.subRow}>
                          <View style={styles.subTick} />
                          <Text style={styles.subText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const LINE = colors.border;
const styles = StyleSheet.create({
  root: { backgroundColor: colors.surfaceStrong, borderRadius: radius.md, padding: space.lg },
  trunk: { paddingLeft: space.md },
  branch: { flexDirection: 'row', paddingTop: space.lg },
  vline: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1.5, backgroundColor: LINE },
  hline: { width: space.lg, height: 1.5, backgroundColor: LINE, marginTop: 27 },
  node: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  nodeTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  nodeTime: { fontSize: 13, color: colors.textSub, marginLeft: space.sm },
  chev: { fontSize: 20, color: colors.textSub, marginLeft: space.sm },
  subs: { marginLeft: space.lg, marginTop: space.sm, borderLeftWidth: 1.5, borderLeftColor: LINE },
  subRow: { flexDirection: 'row', alignItems: 'center', height: 34 },
  subTick: { width: space.md, height: 1.5, backgroundColor: LINE, marginRight: space.sm },
  subText: { fontSize: 14, color: colors.textSub },
  more: { marginLeft: space.lg, paddingVertical: space.sm },
});
