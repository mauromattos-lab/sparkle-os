// agent-loader.ts — carrega arquivos do squad do filesystem
// Lê agent definitions, task definitions e context data

import { readFile } from 'fs/promises';
import { join } from 'path';

const SQUAD_ROOT = join(process.cwd(), 'squads', 'aeo-squad-plaka');

export async function loadAgentPrompt(agentName: string): Promise<string> {
  const filePath = join(SQUAD_ROOT, 'agents', `${agentName}.md`);
  return readFile(filePath, 'utf-8');
}

export async function loadTaskPrompt(taskName: string): Promise<string> {
  const filePath = join(SQUAD_ROOT, 'tasks', `${taskName}.md`);
  return readFile(filePath, 'utf-8');
}

export async function loadContextFile(fileName: string): Promise<string> {
  const filePath = join(SQUAD_ROOT, 'data', fileName);
  return readFile(filePath, 'utf-8');
}

export async function loadSquadContext(): Promise<{
  plakaContext: string;
  postsHistory: string;
}> {
  const [plakaContext, postsHistory] = await Promise.all([
    loadContextFile('plaka-context.md'),
    loadContextFile('posts-history.md'),
  ]);
  return { plakaContext, postsHistory };
}
