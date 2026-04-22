import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRexVeredicto } from './daily-pipeline.mjs';

test('parseRexVeredicto: JSON válido direto', () => {
  const input = '{"veredicto":"APROVADO","feedback":"Ótimo"}';
  const result = parseRexVeredicto(input);
  assert.equal(result.veredicto, 'APROVADO');
  assert.equal(result.feedback, 'Ótimo');
});

test('parseRexVeredicto: tolera trailing comma antes de }', () => {
  const input = '{"veredicto":"REVISAO","feedback":"ajustar tom",}';
  const result = parseRexVeredicto(input);
  assert.equal(result.veredicto, 'REVISAO');
});

test('parseRexVeredicto: tolera trailing comma antes de ] em array interno', () => {
  const input = '{"veredicto":"REVISAO","feedback":"ajustes","pontos":["a","b",]}';
  const result = parseRexVeredicto(input);
  assert.deepEqual(result.pontos, ['a', 'b']);
});

test('parseRexVeredicto: extrai JSON de bloco markdown ```json', () => {
  const input = '```json\n{"veredicto":"APROVADO","feedback":"pronto"}\n```';
  const result = parseRexVeredicto(input);
  assert.equal(result.veredicto, 'APROVADO');
});

test('parseRexVeredicto: extrai JSON de texto ao redor', () => {
  const input = 'Aqui está o veredicto:\n{"veredicto":"ESCALADO","feedback":"crítico"}\nFim.';
  const result = parseRexVeredicto(input);
  assert.equal(result.veredicto, 'ESCALADO');
});

test('parseRexVeredicto: reproduz o bug do run 24723933245 (trailing comma + array)', () => {
  // Shape real que quebrou produção em 2026-04-21
  const input = `{
  "veredicto": "REVISAO",
  "feedback": "Ajustar exemplos e localizar mais para os pais.",
  "pontos": [
    "Adicionar referência a marcas locais",
    "Incluir dicas para os pais.",
  ]
}`;
  const result = parseRexVeredicto(input);
  assert.equal(result.veredicto, 'REVISAO');
  assert.equal(result.pontos.length, 2);
});

test('parseRexVeredicto: erro explícito em string vazia', () => {
  assert.throws(() => parseRexVeredicto(''), /vazia ou inválida/);
});

test('parseRexVeredicto: erro explícito sem chaves', () => {
  assert.throws(() => parseRexVeredicto('só texto sem JSON'), /não retornou JSON válido/);
});

test('parseRexVeredicto: erro com preview se nem sanitização salva', () => {
  // JSON genuinamente irrecuperável
  const input = '{"veredicto": "APROVADO" "feedback": missing_comma}';
  assert.throws(
    () => parseRexVeredicto(input),
    /JSON malformado/
  );
});
