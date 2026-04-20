'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface Conversation {
  id: string;
  phone_number: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ConversationsResponse {
  data: Conversation[];
  limit: number;
  offset: number;
}

export function useConversations(page = 0, pageSize = 20) {
  const offset = page * pageSize;
  return useQuery<ConversationsResponse>({
    queryKey: ['client-conversations', page, pageSize],
    queryFn: () =>
      apiGet<ConversationsResponse>(
        `/cockpit/conversations?limit=${pageSize}&offset=${offset}`,
      ),
    staleTime: 30_000,
  });
}
