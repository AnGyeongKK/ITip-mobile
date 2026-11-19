import { getAnalysisQuota } from '@/api/quota';
import { useQuery } from '@tanstack/react-query';

export const useQuota = () => useQuery({ queryKey: ['quota'], queryFn: getAnalysisQuota, staleTime: 0 });