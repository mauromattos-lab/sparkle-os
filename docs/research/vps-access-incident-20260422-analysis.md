# Análise — Incidente de acesso admin bloqueado à VPS (187.77.37.88)

**Autor:** @analyst (Atlas)
**Data:** 2026-04-22 ~21:00 BRT
**Input:** Relatório de diagnóstico @dev (Dex) de 16:30 BRT
**Objetivo:** Fechar as hipóteses abertas com evidências externas e entregar plano de ação priorizado ao próximo @dev.

---

## TL;DR

1. A **hipótese mais provável mudou**: o bloqueio é quase certamente **IP-banning local na VPS** (fail2ban / sshguard / CrowdSec), **não** um bloqueio do edge da Hostinger.
2. O diagnóstico do Dex **não rodou `fail2ban-client status`** — essa checagem é o teste decisivo que falta.
3. O comportamento observado (IP do WiFi bloqueado, 4G passa, M2M passa, `iptables -P INPUT = ACCEPT`) é o **sintoma-livro** de fail2ban, porque ele injeta regras numa chain própria (`f2b-sshd`) *antes* do default policy e pode passar despercebido em `iptables -L` superficial.
4. Produto VPS da Hostinger **não tem WAF/firewall de rede inbound do lado deles**: o artigo oficial sobre "VPS IP blocked" diz explicitamente que *"these blocks are enforced by third parties – therefore, we are not able to either apply or remove them"*. O Kodee só consegue desbloquear IP da VPS em blocklist **externa** (ex: AbuseIPDB) — caso diferente do nosso.
5. O kernel patch pendente (H3) é **improvável como causa**: a conectividade outbound + M2M inbound funcionam normalmente. Reboot fica como último recurso.
6. **Caminho recomendado:** próximo @dev roda a bateria de diagnóstico fail2ban/sshguard/crowdsec no Web Terminal, identifica o IP do Mauro e unban direto. ETA: **5-10 minutos** se for fail2ban.

---

## Reavaliação das hipóteses

### H1 (original) — Bloqueio da Hostinger no edge → **REDUZIDA para H-residual**

**Research:**
- Hostinger tem produto de firewall/WAF **só para hosting compartilhado**, não para VPS (product tier `KVM/Cloud`).
- Artigo oficial [VPS IP is blocked](https://www.hostinger.com/support/7329020-what-to-do-if-the-vps-ip-is-blocked): cobre só o caso **reverso** — VPS estar em blocklist externa. Recomenda VPN ao cliente, não oferece remoção.
- Artigo [Blocked IP by Hostinger firewall](https://www.hostinger.com/support/blocked-ip-address-hostinger-firewall/): aplica-se a clientes de **shared hosting** cuja visita a um site hospedado é bloqueada pelo WAF compartilhado. Mecanismo Kodee/AbuseIPDB score.
- **Conclusão:** não há evidência documentada de que a Hostinger faça rate-limit inbound em VPSs do próprio cliente. Essa hipótese só sobreviveria se o IP do Mauro tivesse reputação alta (≥16%) no AbuseIPDB, e mesmo assim provavelmente afetaria só porta 80/443 roteada pelo CDN (não SSH bruto na 22).

### H2 (original) — Rate-limit do ISP do Mauro → **MUITO IMPROVÁVEL**

- ISPs residenciais raramente fazem throttling por destino-IP. Esse padrão só aparece em bloqueios regulatórios (sites proibidos judicialmente) — não encaixa com IP de VPS da Hostinger.
- Contra: outbound do Mauro pra google.com/YouTube/etc. não foi reportado como quebrado. Se fosse ISP, teria sintomas cruzados.

### H3 (original) — Kernel/rede inconsistente → **IMPROVÁVEL**

- Pesquisa: casos documentados de "kernel upgrade quebra NIC" resultam em *perda total de rede* na VPS, não em bloqueio seletivo por IP de cliente. Como a VPS está pingando google.com e recebendo webhooks M2M, a NIC e o stack TCP/IP estão íntegros.
- Reboot resolveria um hipotético problema, mas é **tiro no escuro** com clientes em produção. Baixa probabilidade × alto blast radius.

### H4 (original) — Traefik/Chatwoot interno → **SÓ PARCIAL**

- Explica o `curl https://127.0.0.1` travando **para Chatwoot**, mas não explica SSH (porta 22, nada a ver com Traefik) nem Coolify (porta 8000).
- Traefik rate-limiting por IP existe mas não é instalado por default no stack Coolify+Traefik do SparkleOS.

### H5 (nova, ⭐ mais provável) — fail2ban / sshguard / CrowdSec banindo IPs do Mauro + Claude Code

**Evidências convergentes:**
- Sintoma **textbook** de IP-banning local: mesmo IP de origem bloqueado em múltiplos serviços de porta distinta (22, 80, 443, 8000) → só faz sentido se a regra for `DROP -s <IP> ... anywhere`, que é exatamente o que fail2ban cria.
- O Dex observou **"martelou SSH várias vezes essa madrugada"** + Mauro "conexões SSH+HTTPS rápidas". É o padrão clássico que fail2ban detecta como brute force e bane.
- `iptables -P INPUT = ACCEPT` + `4.8M pacotes passando` **não descarta fail2ban**: o default do fail2ban é criar chain dedicada (`f2b-sshd`) e fazer `iptables -I INPUT -j f2b-sshd` na primeira posição. Ele **pula** pacotes que não estão na lista banida e deixa o ACCEPT default atuar no resto. Você só vê a chain com `iptables -L f2b-sshd` ou `iptables -L -n | grep -A 20 f2b`.
- 4G funciona → IP diferente → não entra na lista → passa pela chain → cai no ACCEPT → conecta.
- M2M (Z-API → Chatwoot, Chatwoot → Zenya) funciona → origens que não estão na blocklist local.
- SSHGuard e CrowdSec têm comportamento idêntico, com sintaxe diferente.

**Por que Dex não viu:** relatório parou em `iptables -P INPUT` e `iptables -L` de overview. A chain dedicada do fail2ban não aparece sem `-L <chain-name>` ou `iptables-save`.

### H6 (nova, menor) — Coolify expôs algum middleware do Traefik com RateLimit

- Coolify v4 usa Traefik e algumas imagens prontas de Chatwoot incluem middleware de rate-limit por IP. Se ativado, bloquearia 80/443 do IP do Mauro mas **não SSH** (22).
- Como Mauro também perdeu SSH, H6 sozinho não explica. Pode co-existir com H5.

---

## O que a research externa confirmou sobre remediação

| Ação | Custo | Probabilidade de resolver | Quando fazer |
|------|-------|---------------------------|--------------|
| **Rodar checklist fail2ban/sshguard/crowdsec via Web Terminal + unban IP do Mauro** | Zero, reversível | ~85% se for H5 | **AGORA (próximo dev)** |
| Testar via VPN/WARP/4G tethering | Zero | Confirma que é IP-specific (não resolve) | Se H5 der negativo |
| Cloudflare WARP (Windows 11) | 2 min install, gratuito | Troca IP pro egress da Cloudflare — só atenua, não trata causa | Se Mauro precisa de acesso urgente antes do dev rodar checklist |
| Abrir ticket Hostinger | 15-30min resposta | Baixa (product VPS não tem inbound filter deles) | Só se H5/H6 descartados e VPN não ajuda |
| `sudo systemctl restart networking` | Reversível, ~10s downtime | ~5% (não trata IP ban) | Não recomendado antes de H5 |
| Reboot VPS | 2 min downtime, afeta Julia/Chatwoot/Zenya | ~10% | Último recurso |

### Sobre Cloudflare WARP (nota pro Mauro)

Research: WARP **não é VPN tradicional** — é "privacy tunnel". Troca seu IP pelo de um PoP Cloudflare, então **pra fins de driblar um IP-ban específico, funciona sim**. Instalação Windows 11: [1.1.1.1 + WARP](https://1.1.1.1), próximo-próximo-ligar toggle. Gratuito, sem cadastro.

Alternativas reais de VPN pra trocar IP garantidamente: ProtonVPN Free, Mullvad, ou tethering do celular no 4G (já confirmado funcionando).

---

## Artefatos gerados

1. Este documento: `docs/research/vps-access-incident-20260422-analysis.md`
2. Handoff YAML pro próximo @dev: `.aiox/handoffs/handoff-analyst-to-dev-20260422-vps-access-research.yaml`

## Sources

- [Hostinger — What to do if the VPS IP is blocked](https://www.hostinger.com/support/7329020-what-to-do-if-the-vps-ip-is-blocked)
- [Hostinger — How to check if your IP is blocked by Hostinger firewall](https://www.hostinger.com/support/blocked-ip-address-hostinger-firewall/) *(shared hosting WAF — não VPS)*
- [Hostinger — Troubleshooting SSH Connection Timeout Issues on VPS](https://www.hostinger.com/support/8894153-troubleshooting-ssh-connection-timeout-issues-on-vps-at-hostinger/)
- [Hostinger — How to Use the Browser Terminal](https://www.hostinger.com/support/7978544-how-to-use-the-browser-terminal-in-hostinger/)
- [DigitalOcean — Protect SSH with Fail2ban on Ubuntu 20.04](https://www.digitalocean.com/community/tutorials/how-to-protect-ssh-with-fail2ban-on-ubuntu-20-04)
- [SpinupWP — How to Unban and Whitelist IP Addresses in Fail2ban](https://spinupwp.com/doc/how-to-unban-and-whitelist-ip-addresses-in-fail2ban/)
- [fail2ban issue #745 — banned IP doesn't show up in plain iptables](https://github.com/fail2ban/fail2ban/issues/745)
- [Cloudflare — WARP Windows desktop client](https://developers.cloudflare.com/warp-client/get-started/windows/)
- [AbuseIPDB — free IP reputation check](https://www.abuseipdb.com/)
- [Ubuntu discourse — kernel upgrade breaks NIC on 22.04](https://discourse.ubuntu.com/t/update-to-kernel-5-15-0-136-generic-ubuntu-22-04-5-lts-breaks-nic/58817)

— Atlas, investigando a verdade
