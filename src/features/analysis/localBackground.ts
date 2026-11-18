import { requireOptionalNativeModule } from 'expo-modules-core';
import { API_BASE_URL } from '@/api/client';

type Native = {
  startLocalAnalysis?: (batchId: string, baseUrl: string, collect: boolean) => Promise<void>;
  resumeLocalAnalysis?: (batchId: string, baseUrl: string) => Promise<void>;
  localAnalysisState?: (batchId: string) => Promise<string>;
};
const native = requireOptionalNativeModule<Native>('CaptionCollector');

export async function startLocalAnalysis(batchId: string, collect: boolean) {
  if (!native?.startLocalAnalysis) throw new Error('LOCAL_BACKGROUND_BUILD_REQUIRED');
  await native.startLocalAnalysis(batchId, API_BASE_URL, collect);
}

export async function resumeLocalAnalysis(batchId: string) {
  if (!native?.resumeLocalAnalysis) throw new Error('LOCAL_BACKGROUND_BUILD_REQUIRED');
  await native.resumeLocalAnalysis(batchId, API_BASE_URL);
}

export async function localAnalysisState(batchId: string): Promise<{ phase?: string; itemId?: string }> {
  const value = await native?.localAnalysisState?.(batchId);
  return value ? JSON.parse(value) : {};
}
