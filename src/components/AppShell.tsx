// 공통 상단바(☰ 또는 ‹ · 프로필) + NAV-DRAWER + 우측 하단 'ITip Agent' 버튼
// 피그마 '디자인 확정 화면'(11/11) 기준. 화면마다 <AppScreen>으로 감싸 쓴다.
import { router, usePathname } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMockAuth } from '../features/auth/mockAuth';
import { colors, font, fontFamily, palette, radius, space, typography } from '../theme/tokens';
import { NavIcon, type NavIconName } from './NavIcons';
import { Icon } from './ui';

type NavItem = { label: string; icon?: NavIconName; href?: string; sub?: boolean; disabledNote?: string };

// 디자인(NAV-DRAWER): 글자는 모두 x=64에서 시작하고, 아이콘이 없는 줄은 그 자리를 비워 둔다.
const NAV: NavItem[] = [
  { label: '홈', icon: 'home', href: '/' },
  { label: '내 아카이브', icon: 'archive' },
  { label: '분석 기록', href: '/archive/records', sub: true },
  { label: '폴더', icon: 'folder', href: '/archive/folders' },
  { label: '키워드', href: '/archive/keywords', sub: true },
  { label: 'ITip Agent', href: '/agent' },
  { label: '요금제 / 구독', icon: 'card', disabledNote: '시연 이후' },
  { label: '알림 설정', sub: true, disabledNote: '시연 이후' },
  { label: '계정 설정', sub: true, disabledNote: '시연 이후' },
];

function NavRow({ item, active, onPress }: { item: NavItem; active: boolean; onPress?: () => void }) {
  const color = item.disabledNote ? colors.textMuted : active ? colors.primaryDeep : colors.text;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.navRow, active && styles.navActive]}>
      <View style={styles.navIcon}>{item.icon ? <NavIcon name={item.icon} color={color} /> : null}</View>
      <Text style={[item.sub ? styles.labelSub : typography.subtitle16Semibold, { color }]}>{item.label}</Text>
      {item.disabledNote ? <Text style={[font.caption, { marginLeft: 'auto' }]}>{item.disabledNote}</Text> : null}
    </Pressable>
  );
}

export function NavDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const signOut = useMockAuth((s) => s.signOut);
  const go = (href?: string) => {
    if (!href) return;
    onClose();
    router.navigate(href as never);
  };
  const logout = () => {
    onClose();
    signOut();
    router.replace('/login' as never);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerBackdrop}>
        <View style={[styles.drawer, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.logoRow}>
            <Icon source={require('../../assets/icons/app-icon.svg')} width={28} height={28} />
            <Text style={[typography.heading22, { color: colors.primaryDark }]}>ITip</Text>
          </View>
          <View style={styles.profile}>
            <Text style={typography.subtitle16Bold}>시연 사용자</Text>
            <View style={styles.planPill}><Text style={[typography.button12, { color: palette.primary[60] }]}>Free</Text></View>
          </View>
          <View style={styles.list}>
            {NAV.map((item) => {
              const active = !!item.href && (item.href === '/' ? path === '/' : path.startsWith(item.href));
              return <NavRow key={item.label} item={item} active={active} onPress={item.href ? () => go(item.href) : undefined} />;
            })}
          </View>
          <View style={{ flex: 1 }} />
          <View style={[styles.planPill, { alignSelf: 'flex-start', marginLeft: 16 }]}>
            <Text style={[typography.button12, { color: palette.primary[60] }]}>Free 플랜</Text>
          </View>
          <Pressable onPress={logout} style={[styles.navRow, { marginTop: 8 }]} accessibilityLabel="로그아웃">
            <View style={styles.navIcon}><NavIcon name="logout" color={colors.text} /></View>
            <Text style={typography.subtitle16Semibold}>로그아웃</Text>
          </Pressable>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
  );
}

/** back=true면 왼쪽에 뒤로가기(결과·구간 상세 디자인), 아니면 메뉴(☰) */
export function AppHeader({ back, onBack }: { back?: boolean; onBack?: () => void }) {
  const [open, setOpen] = useState(false);
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/')));
  return (
    <>
      <View style={styles.header}>
        {back ? (
          <Pressable hitSlop={12} onPress={goBack} accessibilityLabel="뒤로 가기" style={styles.iconBox}>
            <Icon source={require('../../assets/icons/back.svg')} width={19} height={18} />
          </Pressable>
        ) : (
          <Pressable hitSlop={12} onPress={() => setOpen(true)} accessibilityLabel="메뉴 열기" style={styles.iconBox}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        )}
        <View style={styles.iconBox} accessibilityLabel="프로필">
          <Icon source={require('../../assets/icons/profile.svg')} width={15.8} height={16.8} />
        </View>
      </View>
      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** extended: 'ITip Agent' 글자가 들어간 넓은 버튼 (결과 > 상세 내용 디자인) */
export function AgentFab({ onPress, extended }: { onPress: () => void; extended?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, extended && styles.fabExtended, pressed && { opacity: 0.8 }]} accessibilityLabel="ITip Agent 열기">
      {extended ? (
        <>
          <Text style={[typography.heading18, { color: colors.onPrimary }]}>ITip Agent</Text>
          <Icon source={require('../../assets/icons/agent-ai.svg')} width={20} height={20} />
        </>
      ) : (
        <Icon source={require('../../assets/icons/agent-fab.svg')} width={27} height={27} />
      )}
    </Pressable>
  );
}

/** 상단바 + 본문 + (선택) Agent 버튼 */
export function AppScreen({ children, onAgent, back, onBack, agentExtended }: { children: React.ReactNode; onAgent?: () => void; back?: boolean; onBack?: () => void; agentExtended?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <AppHeader back={back} onBack={onBack} />
      <View style={{ flex: 1 }}>{children}</View>
      {onAgent ? <AgentFab onPress={onAgent} extended={agentExtended} /> : null}
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
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, backgroundColor: colors.bg },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 20, lineHeight: 24, color: colors.icon },
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 100, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 4px 5px ${colors.fabShadow}` },
  fabExtended: { width: undefined, height: undefined, flexDirection: 'row', gap: 4, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: 20 },
  // 메뉴(피그마 NAV-DRAWER): 폭 300, 어두운 배경 50%
  drawerBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(13,29,40,0.5)' },
  drawer: { width: 300, maxWidth: '88%', backgroundColor: colors.bg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 20 },
  planPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  list: { marginTop: 20 },
  navRow: { height: 40, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  navActive: { backgroundColor: colors.primarySoft },
  navIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  labelSub: { ...typography.subtitle16Semibold, fontFamily: fontFamily.medium },
});