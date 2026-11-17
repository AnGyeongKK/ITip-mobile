// 메뉴(드로어) 아이콘. 디자인에서 내보낸 SVG가 없어서 선 아이콘을 직접 그렸다. 파일이 생기면 이 파일만 바꾸면 된다.
import Svg, { Path, Rect } from 'react-native-svg';

export type NavIconName = 'home' | 'archive' | 'folder' | 'card' | 'logout';

export function NavIcon({ name, color, size = 20 }: { name: NavIconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' ? (
        <>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p} />
          <Path d="M9 22V12h6v10" {...p} />
        </>
      ) : null}
      {name === 'archive' ? (
        <>
          <Path d="M21 8v13H3V8" {...p} />
          <Path d="M1 3h22v5H1z" {...p} />
          <Path d="M10 12h4" {...p} />
        </>
      ) : null}
      {name === 'folder' ? (
        <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" {...p} />
      ) : null}
      {name === 'card' ? (
        <>
          <Rect x={1} y={4} width={22} height={16} rx={2} {...p} />
          <Path d="M1 10h22" {...p} />
        </>
      ) : null}
      {name === 'logout' ? (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...p} />
          <Path d="M16 17l5-5-5-5" {...p} />
          <Path d="M21 12H9" {...p} />
        </>
      ) : null}
    </Svg>
  );
}