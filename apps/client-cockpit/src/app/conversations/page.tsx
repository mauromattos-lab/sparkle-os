import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { ConversationTable } from '@/components/ConversationTable';
import Link from 'next/link';

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Zenya — Painel</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Voltar ao painel
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">Conversas</h2>
        </div>
        <ConversationTable />
      </div>
    </main>
  );
}
