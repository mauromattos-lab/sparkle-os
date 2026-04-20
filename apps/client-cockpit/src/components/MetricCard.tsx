interface MetricCardProps {
  label: string;
  value: number | string;
  loading?: boolean;
}

export function MetricCard({ label, value, loading }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
}
