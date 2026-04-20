'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

type State = 'idle' | 'loading' | 'sent' | 'error';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('loading');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setState('error');
      setErrorMsg(error.message);
    } else {
      setState('sent');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Zenya</h1>
          <p className="mt-2 text-sm text-gray-500">Painel do cliente</p>
        </div>

        {state === 'sent' ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="font-medium text-green-800">Link enviado! ✉️</p>
            <p className="mt-2 text-sm text-green-700">
              Verifique seu e-mail <strong>{email}</strong> e clique no link para entrar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  disabled={state === 'loading'}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                />
              </div>

              {state === 'error' && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
                  {errorMsg || 'Erro ao enviar o link. Tente novamente.'}
                </p>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {state === 'loading' ? 'Enviando...' : 'Enviar magic link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
