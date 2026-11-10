export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/expo-shar(e|ing)-intent/.test(path)) return '/';
    return path;
  } catch {
    return '/';
  }
}