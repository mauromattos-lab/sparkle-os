// client-config.ts — Story 5.6
// Loads per-client configuration from clients/{clientId}/config.yaml
// Enables onboarding a new client without changing code

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

export interface ClientConfig {
  clientId: string;
  name: string;
  squadPath: string;
  scheduleTime: string;
  brandVoice?: string;
}

const CLIENTS_ROOT = join(process.cwd(), 'clients');
const DEFAULT_SCHEDULE = '0 8 * * *';

/**
 * Minimal flat YAML parser — handles top-level key: value pairs only.
 * Sufficient for the simple client config format.
 */
function parseConfigYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value) result[key] = value;
  }
  return result;
}

export async function loadClientConfig(clientId: string): Promise<ClientConfig> {
  const configPath = join(CLIENTS_ROOT, clientId, 'config.yaml');
  let content: string;
  try {
    content = await readFile(configPath, 'utf-8');
  } catch {
    throw new Error(`Client config not found: ${configPath}`);
  }

  const parsed = parseConfigYaml(content);

  const config: ClientConfig = {
    clientId: parsed['clientId'] ?? clientId,
    name: parsed['name'] ?? clientId,
    squadPath: parsed['squadPath'] ?? `squads/aeo-squad-${clientId}`,
    scheduleTime: parsed['scheduleTime'] ?? DEFAULT_SCHEDULE,
  };
  if (parsed['brandVoice']) config.brandVoice = parsed['brandVoice'];
  return config;
}

export async function listClientIds(): Promise<string[]> {
  try {
    const entries = await readdir(CLIENTS_ROOT, { withFileTypes: true });
    const clientDirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => e.name);
    return clientDirs;
  } catch {
    // If clients/ dir doesn't exist, fall back to default client
    return ['plaka'];
  }
}
