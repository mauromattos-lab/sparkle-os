// Unit tests for client-config.ts — Story 5.6

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, readdir } from 'fs/promises';
import { loadClientConfig, listClientIds } from './client-config.js';

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

const PLAKA_CONFIG_YAML = `
# Plaka config
clientId: plaka
name: Plaka Acessórios
squadPath: squads/aeo-squad-plaka
scheduleTime: "0 8 * * *"
brandVoice: especialista-acessivel
`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadClientConfig', () => {
  it('AC1: loads and parses client config from clients/{clientId}/config.yaml', async () => {
    mockReadFile.mockImplementation(async () => PLAKA_CONFIG_YAML);

    const config = await loadClientConfig('plaka');

    expect(config.clientId).toBe('plaka');
    expect(config.name).toBe('Plaka Acessórios');
    expect(config.squadPath).toBe('squads/aeo-squad-plaka');
    expect(config.scheduleTime).toBe('0 8 * * *');
    expect(config.brandVoice).toBe('especialista-acessivel');
  });

  it('throws when config file not found', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));

    await expect(loadClientConfig('nonexistent')).rejects.toThrow('Client config not found');
  });

  it('AC3: uses clientId as fallback for missing fields', async () => {
    mockReadFile.mockImplementation(async () => 'clientId: minimal\n');

    const config = await loadClientConfig('minimal');

    expect(config.clientId).toBe('minimal');
    expect(config.name).toBe('minimal'); // fallback to clientId
    expect(config.squadPath).toBe('squads/aeo-squad-minimal'); // fallback pattern
    expect(config.scheduleTime).toBe('0 8 * * *'); // default schedule
  });

  it('parses quoted scheduleTime correctly', async () => {
    mockReadFile.mockImplementation(async () => 'clientId: test\nscheduleTime: "0 9 * * *"\n');

    const config = await loadClientConfig('test');
    expect(config.scheduleTime).toBe('0 9 * * *');
  });
});

describe('listClientIds', () => {
  it('AC3: returns list of client IDs from clients/ directory', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'plaka', isDirectory: () => true },
      { name: 'nova-marca', isDirectory: () => true },
      { name: '_template', isDirectory: () => true }, // should be excluded
      { name: 'readme.md', isDirectory: () => false }, // should be excluded
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const clients = await listClientIds();
    expect(clients).toContain('plaka');
    expect(clients).toContain('nova-marca');
    expect(clients).not.toContain('_template'); // underscore prefix excluded
    expect(clients).not.toContain('readme.md'); // files excluded
  });

  it('returns ["plaka"] as fallback when clients/ dir does not exist', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

    const clients = await listClientIds();
    expect(clients).toEqual(['plaka']);
  });
});
