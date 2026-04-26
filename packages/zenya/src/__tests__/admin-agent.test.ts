import { describe, it, expect } from 'vitest';
import { isBurstMessage } from '../agent/admin-agent.js';

// Story 18.3: Burst admin filter — Z-API sincroniza histórico ao parear,
// gerando rajada de webhooks com mensagens antigas. Filtro deve detectar:
// (mensagem do passado >60s) AND (boot grace ativo <60s) → SKIP.
// Mensagens do PRESENTE jamais filtradas.
describe('isBurstMessage (Story 18.3)', () => {
  // Reference time: 2026-04-26T10:00:00Z (epoch ms)
  const NOW = 1777_536_000_000;

  it('SKIP: boot recente (<60s) + msg histórica (>60s atrás) → burst detected', () => {
    const bootTime = NOW - 30_000; // boot há 30s (em grace)
    const messageCreatedAt = NOW - 5 * 60_000; // msg há 5min (passado)
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(true);
  });

  it('PROCESS: boot recente (<60s) + msg do presente (<60s atrás) → não é burst', () => {
    const bootTime = NOW - 30_000; // boot há 30s (em grace)
    const messageCreatedAt = NOW - 5_000; // msg há 5s (presente)
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(false);
  });

  it('PROCESS: boot antigo (>60s) + msg histórica → não é burst (grace expirou)', () => {
    const bootTime = NOW - 5 * 60_000; // boot há 5min (grace já expirou)
    const messageCreatedAt = NOW - 10 * 60_000; // msg há 10min (passado)
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(false);
  });

  it('PROCESS: boot exatamente 60s atrás → grace ainda ativo (boundary)', () => {
    const bootTime = NOW - 59_999; // boot há 59.999s — ainda em grace
    const messageCreatedAt = NOW - 5 * 60_000; // msg há 5min
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(true);
  });

  it('PROCESS: boot >=60s atrás → grace expirou (boundary)', () => {
    const bootTime = NOW - 60_000; // boot há exatamente 60s (já fora do grace)
    const messageCreatedAt = NOW - 5 * 60_000; // msg histórica
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(false);
  });

  it('PROCESS: msg exatamente 60s atrás → ainda é "presente" (boundary)', () => {
    const bootTime = NOW - 30_000;
    const messageCreatedAt = NOW - 60_000; // msg há 60s — limite presente
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(false);
  });

  it('SKIP: msg >60s atrás → considera passado (boundary)', () => {
    const bootTime = NOW - 30_000;
    const messageCreatedAt = NOW - 60_001; // msg há 60.001s — passado
    expect(isBurstMessage(messageCreatedAt, NOW, bootTime)).toBe(true);
  });
});
