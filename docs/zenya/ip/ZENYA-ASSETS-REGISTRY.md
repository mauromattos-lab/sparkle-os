# Registry de Assets Visuais — Zenya IP

**Versão:** v1.0.0
**Inventariado por:** @analyst (Atlas) — Story 2.2
**Data upload:** 2026-04-11
**Bucket Supabase:** `zenya-ip-assets`
**Prefixo:** `v1/`
**URL base:** `https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/`

---

> ⚠️ **AVISO:** Assets preservados em Supabase Storage para garantir existência independente do estado local. Hashes SHA-256 servem como referência de integridade — qualquer alteração nos arquivos originais produzirá hash diferente.

---

## Inventário Completo

| Arquivo Original | Nome Supabase | Hash SHA-256 | Tamanho | Supabase URL | Upload |
|-----------------|---------------|-------------|---------|-------------|--------|
| `COBRANÇA.pdf` | `COBRANCA.pdf` | `6d16b19e62b65be52acc778454042bb89e7cb82344546396cf75a8aab8ed8790` | 131,8 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/COBRANCA.pdf) | 2026-04-11 |
| `DR. ANA SILVA.png` | `DR.-ANA-SILVA.png` | `9ba51232c46cb7f300eebe7c51f67dcf67be78922393c2a2433392a33c51c210` | 2.278,0 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/DR.-ANA-SILVA.png) | 2026-04-11 |
| `DR. CARLA MENDES.png` | `DR.-CARLA-MENDES.png` | `724d667a78f99e66e7fb9d09a1bd5105c3e5b543d4aaeff069a46badae3d63c8` | 2.375,0 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/DR.-CARLA-MENDES.png) | 2026-04-11 |
| `DR. JOÃO PAULO FERREIRA.png` | `DR.-JOAO-PAULO-FERREIRA.png` | `40facfeac81259b82485e5f80797d52b59640b9e0cf6de13310980e6e48f9122` | 2.032,0 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/DR.-JOAO-PAULO-FERREIRA.png) | 2026-04-11 |
| `DR. ROBERTO ALMEIDA.png` | `DR.-ROBERTO-ALMEIDA.png` | `ecaa109758c008db505aadc45246c8986373361abba45b2b8b8e1f8d74fc090d` | 2.148,5 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/DR.-ROBERTO-ALMEIDA.png) | 2026-04-11 |
| `PROCEDIMENTO EXAME DE SANGUE.png` | `PROCEDIMENTO-EXAME-DE-SANGUE.png` | `d1c2af967c0dd02f29c7e34d3e007c116c2aefc7e5ab091175e311c02dd72783` | 1.987,0 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/PROCEDIMENTO-EXAME-DE-SANGUE.png) | 2026-04-11 |
| `PROCEDIMENTO TESTE ERGOMÉTRICO.png` | `PROCEDIMENTO-TESTE-ERGOMETRICO.png` | `3ac38b88a32e6e079ea04360b9fbfda52e20028c1bd4c5539a4ad975231c82cc` | 2.151,2 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/PROCEDIMENTO-TESTE-ERGOMETRICO.png) | 2026-04-11 |
| `PROCEDIMENTO ULTASSOM.png` | `PROCEDIMENTO-ULTASSOM.png` | `db0af3f546fd3dc151e7bc7ca7d8353dcc2e4ac0d5f0067c725ff1fda3cc28fa` | 2.089,1 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/PROCEDIMENTO-ULTASSOM.png) | 2026-04-11 |
| `PROFISSIONAIS.png` | `PROFISSIONAIS.png` | `358b95c3e0af02f3fa8f6111d44e8d4a5ccbc009d5acfb8f55099bf67161d890` | 2.084,6 KB | [link](https://gqhdspayjtiijcqklbys.supabase.co/storage/v1/object/public/zenya-ip-assets/v1/PROFISSIONAIS.png) | 2026-04-11 |

**Total:** 9 arquivos | ~19,5 MB

---

## Fonte dos Assets

**Localização original (máquina de Mauro):**
```
C:\Users\Mauro\Downloads\02. Mauro\Material Secretária v3\Material Secretária v3\Arquivos da Secretária v3\
```

**Uso na Zenya:**
- Fotos de profissionais (`DR. *.png`, `PROFISSIONAIS.png`) — enviadas pela Zenya quando clientes solicitam informações sobre a equipe médica
- Documento de cobrança (`COBRANÇA.pdf`) — enviado no fluxo `06. Integração Asaas` como comprovante/informativo de cobrança
- Procedimentos (`PROCEDIMENTO *.png`) — enviados quando clientes perguntam sobre procedimentos disponíveis

---

## Convenções de Nomenclatura

Para upload de versões futuras (aprovadas via SOP):
- Espaços → hífens
- Caracteres acentuados → equivalente ASCII (Ç→C, Ã→A, É→E, Ô→O, etc.)
- Caixa alta mantida
- Novo prefixo de versão: `v2/`, `v3/`, etc.

---

## Verificação de Integridade

Para verificar que um arquivo não foi alterado, calcule o SHA-256 e compare com a tabela:

```bash
# Windows (PowerShell)
Get-FileHash "COBRANÇA.pdf" -Algorithm SHA256

# Linux/Mac
sha256sum "COBRANÇA.pdf"
```

Se o hash diferir, o arquivo foi modificado — acionar aprovação de Mauro via SOP antes de atualizar.

---

*Inventariado por @analyst (Atlas) — Story 2.2 — 2026-04-11*
