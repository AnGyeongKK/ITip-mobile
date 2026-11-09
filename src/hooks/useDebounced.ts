import { useEffect, useState } from 'react';

/** 검색어 입력이 멈춘 뒤에만 API를 부르도록 지연시킨다 */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
