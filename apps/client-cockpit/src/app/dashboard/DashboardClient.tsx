'use client';
import { useMetrics } from '@/hooks/useMetrics';
import { MetricCard } from '@/components/MetricCard';
import Link from 'next/link';

const STATUS_LABEL: Record<string, string> = {
  active: '✅ Ativo',
  inactive: '❌ Inativo',
};

export function DashboardClient() {
  const { data, isLoading, isError } = useMetrics();

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
        Erro ao carregar métricas. Verifique sua conexão.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Visão geral</h2>
        <p className="mt-1 text-sm text-gray-500">Atualizado a cada minuto</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Conversas hoje"
          value={data?.conversationsToday ?? 0}
          loading={isLoading}
        />
        <MetricCard
          label="Total de conversas"
          value={data?.totalConversations ?? 0}
          loading={isLoading}
        />
        <MetricCard
          label="Status do sistema"
          value={STATUS_LABEL[data?.systemStatus ?? ''] ?? data?.systemStatus ?? '—'}
          loading={isLoading}
        />
      </div>

      {/* Ação rápida */}
      <div>
        <Link
          href="/conversations"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Ver conversas →
        </Link>
      </div>
    </div>
  );
}
