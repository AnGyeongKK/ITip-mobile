// 공통 상단바(☰ · 로고 · 프로필) + NAV-DRAWER + 우측 하단 'ITip Agent' 버튼
// 피그마 11/06 기준. 화면마다 <AppScreen>으로 감싸 쓴다.
import { router, usePathname } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '../theme/tokens';

type NavItem = { label: string; href?: string; indent?: boolean; disabledNote?: string };

const NAV: NavItem[][] = [
  [
    { label: '홈', href: '/' },
    { label: '내 아카이브' },
    { label: '분석 기록', href: '/archive/records', indent: true },
    { label: '폴더', href: '/archive/folders', indent: true },
    { label: '키워드', href: '/archive/keywords', indent: true },
    { label: 'ITip Agent', href: '/agent' },
  ],
  [{ label: '요금제 / 구독', disabledNote: '시연 이후' }],
  [
    { label: '알림 설정', disabledNote: '시연 이후' },
    { label: '계정 설정', disabledNote: '시연 이후' },
  ],
];

export function NavDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const go = (href?: string) => {
    if (!href) return;
    onClose();
    router.navigate(href as never);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerBackdrop}>
        <View style={[styles.drawer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.drawerHead}>
            <View style={styles.logo} />
            <Pressable hitSlop={12} onPress={onClose}><Text style={{ fontSize: 18, color: colors.textSub }}>✕</Text></Pressable>
          </View>
          <View style={styles.profile}>
            <View style={styles.avatar} />
            <Text style={[font.h3, { flex: 1, marginLeft: space.sm }]}>시연 사용자</Text>
            <View style={styles.planBadge}><Text style={font.caption}>Free</Text></View>
          </View>
          {NAV.map((group, gi) => (
            <View key={gi} style={[gi > 0 && styles.groupDivider]}>
              {group.map((item) => {
                const active = item.href && (item.href === '/' ? path === '/' : path.startsWith(item.href));
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => go(item.href)}
                    disabled={!item.href}
                    style={[styles.navItem, item.indent && { paddingLeft: space.xxl + space.md }, active && styles.navActive]}
                  >
                    <Text style={[item.indent ? font.body : font.h3, item.disabledNote && { color: colors.textMuted }]}>{item.label}</Text>
                    {item.disabledNote ? <Text style={font.caption}>{item.disabledNote}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ flex: 1 }} />
          <View style={styles.planBox}><Text style={font.h3}>Free 플랜</Text></View>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
  );
}

export function AppHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => setOpen(true)} accessibilityLabel="메뉴 열기"><Text style={styles.icon}>☰</Text></Pressable>
        <Pressable onPress={() => router.navigate('/')} style={styles.logo} accessibilityLabel="홈으로" />
        <Text style={[styles.icon, { color: colors.textMuted }]}>◯</Text>
      </View>
      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AgentFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.8 }]} accessibilityLabel="ITip Agent 열기">
      <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>ITip Agent</Text>
    </Pressable>
  );
}

/** 상단바 + 본문 + (선택) Agent 버튼 */
export function AppScreen({ children, onAgent }: { children: React.ReactNode; onAgent?: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <AppHeader />
      <View style={{ flex: 1 }}>{children}</View>
      {onAgent ? <AgentFab onPress={onAgent} /> : null}
    </SafeAreaView>
  );
}

/** 내 아카이브 > 분석 기록 같은 경로 표시 + 뒤로 */
export function Breadcrumb({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => router.back())} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
      <Text style={font.caption}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  icon: { fontSize: 22, color: colors.text, width: 28, textAlign: 'center' },
  logo: { width: 96, height: 30, backgroundColor: colors.surfaceStrong, borderRadius: 2 },
  fab: { position: 'absolute', right: space.lg, bottom: space.xl, paddingHorizontal: space.xl, height: 48, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  drawerBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: { width: '82%', backgroundColor: colors.bg, paddingHorizontal: space.lg },
  drawerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.md },
  profile: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, marginBottom: space.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceStrong },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  groupDivider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.sm, paddingTop: space.sm },
  navItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md },
  navActive: { backgroundColor: colors.surface },
  planBox: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.lg },
});
