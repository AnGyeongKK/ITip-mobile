import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as Crypto from 'expo-crypto';
import type { ApiResponse } from './types';

/**
 * .env 예시
 *   EXPO_PUBLIC_API_BASE_URL=https://<cloud-run-api>
 *   EXPO_PUBLIC_CHAT_BASE_URL=https://<cloud-run-chat>
 *   EXPO_PUBLIC_USE_MOCK=true      // 백엔드 준비 전에는 true
 *
 * 시연에서는 서버가 DEMO_USER_ID로 사용자를 정하므로 인증 헤더를 보내지 않는다.
 * 로그인이 들어오면 setAccessTokenProvider로 Bearer 토큰을 붙이면 된다.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
export const CHAT_BASE_URL = process.env.EXPO_PUBLIC_CHAT_BASE_URL ?? API_BASE_URL;
export const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK ?? 'true') === 'true';

/** 서버 오류를 화면에서 분기하기 쉬운 형태로 바꾼다. message가 아니라 status·code로 분기할 것. */
export class ApiError extends Error {
  constructor(
    public status: number | null,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
  get isNotFound() { return this.status === 404; }
  get isConflict() { return this.status === 409; }
  get isLimit() { return this.status === 429; }
  get isNetwork() { return this.status === null; }
}

let accessTokenProvider: (() => string | null) | null = null;
export function setAccessTokenProvider(fn: () => string | null) {
  accessTokenProvider = fn;
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
  // keywordIds=41&keywordIds=42 형태로 직렬화 (SEARCH-01/02 명세)
  paramsSerializer: { indexes: null },
});

http.interceptors.request.use((config) => {
  const token = accessTokenProvider?.();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const err = e as AxiosError<ApiResponse<unknown>>;
  if (err.response) {
    const body = err.response.data;
    return new ApiError(
      err.response.status,
      body?.code ?? 'UNKNOWN_ERROR',
      body?.message ?? '요청을 처리하지 못했어요.',
      err.response.headers?.['x-request-id'] as string | undefined,
    );
  }
  return new ApiError(null, 'NETWORK_ERROR', '네트워크 연결을 확인해 주세요.');
}

/** ApiResponse를 벗겨 data만 돌려준다. data가 없는 응답(삭제 등)은 undefined. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.request<ApiResponse<T>>(config);
    return res.data.data as T;
  } catch (e) {
    throw toApiError(e);
  }
}

export const newIdempotencyKey = () => Crypto.randomUUID();

/** 빈 문자열·빈 배열 쿼리는 보내지 않는다. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (Array.isArray(v) && v.length === 0) return;
    out[k] = v;
  });
  return out as Partial<T>;
}

/** mock 응답에 약간의 지연을 줘서 로딩 상태를 확인할 수 있게 한다. */
export const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
