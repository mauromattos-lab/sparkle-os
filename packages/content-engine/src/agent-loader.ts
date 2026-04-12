// agent-loader.ts — carrega arquivos do squad do filesystem
// Lê agent definitions, task definitions e context data
// Story 5.6: parametrizado por cliente via client config

import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadClientConfig } from './client-config.js';

export async function loadAgentPrompt(agentName: string, squadRoot?: string): Promise<string> {
  const root = squadRoot ?? join(process.cwd(), 'squads', 'aeo-squad-plaka');
  const filePath = join(root, 'agents', `${agentName}.md`);
  return readFile(filePath, 'utf-8');
}

export async function loadTaskPrompt(taskName: string, squadRoot?: string): Promise<string> {
  const root = squadRoot ?? join(process.cwd(), 'squads', 'aeo-squad-plaka');
  const filePath = join(root, 'tasks', `${taskName}.md`);
  return readFile(filePath, 'utf-8');
}

export async function loadContextFile(fileName: string, squadRoot?: string): Promise<string> {
  const root = squadRoot ?? join(process.cwd(), 'squads', 'aeo-squad-plaka');
  const filePath = join(root, 'data', fileName);
  return readFile(filePath, 'utf-8');
}

/**
 * Loads squad context for a given client.
 * - clientContext: loaded from clients/{clientId}/client-context.md (AC2)
 * - postsHistory: loaded from the squad's data/posts-history.md
 */
export async function loadSquadContext(clientId = 'plaka'): Promise<{
  clientContext: string;
  postsHistory: string;
}> {
  const config = await loadClientConfig(clientId);
  const squadRoot = join(process.cwd(), config.squadPath);

  const clientContextPath = join(process.cwd(), 'clients', clientId, 'client-context.md');

  const [clientContext, postsHistory] = await Promise.all([
    readFile(clientContextPath, 'utf-8'),
    readFile(join(squadRoot, 'data', 'posts-history.md'), 'utf-8'),
  ]);

  return { clientContext, postsHistory };
}
