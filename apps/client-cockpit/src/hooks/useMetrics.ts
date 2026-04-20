'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface ClientMetrics {
  totalConversations: number;
  conversationsToday: number;
  systemStatus: string;
}

export function useMetrics() {
  return useQuery<ClientMetrics>({
    queryKey: ['client-metrics'],
    queryFn: () => apiGet<ClientMetrics>('/cockpit/metrics'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
