import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_KEY']!,
);

export interface ClientSession {
  tenantId: string;
  tenantName: string;
}

export class ClientNotFoundError extends Error {
  constructor(userId: string) {
    super(`Nenhum tenant Zenya ativo vinculado ao usuário: ${userId}`);
    this.name = 'ClientNotFoundError';
  }
}

export async function getClientSession(userId: string): Promise<ClientSession> {
  const { data, error } = await supabase
    .from('zenya_client_users')
    .select('zenya_tenants(id, name)')
    .eq('user_id', userId)
    .limit(1)
    .single<{ zenya_tenants: { id: string; name: string } | null }>();

  if (error || !data?.zenya_tenants) throw new ClientNotFoundError(userId);

  return {
    tenantId: data.zenya_tenants.id,
    tenantName: data.zenya_tenants.name,
  };
}
