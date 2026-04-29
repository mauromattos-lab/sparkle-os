// Google Calendar integration — 5 tools for appointment management
// Credentials are loaded per-tenant from zenya_tenant_credentials (AES-256-GCM encrypted)
// All tools use tenantId via closure — never as LLM parameter

import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { google } from 'googleapis';
import { getCredentialJson } from '../tenant/credentials.js';
import type { TenantConfig } from '../tenant/config-loader.js';

interface GoogleCalendarCredentials {
  // OAuth2 mode
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  // Service account mode (SA JSON embedded — same pattern as sheets_kb)
  service_account?: Record<string, unknown>;
  // Common
  calendar_id?: string;          // defaults to 'primary'
  duration_minutes?: number;     // default appointment duration, defaults to 30
}

const TIMEOUT_MS = 15_000;

function getCalendarClient(creds: GoogleCalendarCredentials) {
  if (creds.service_account) {
    // Service account mode — SA JSON stored in credentials (same pattern as sheets_kb)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = new google.auth.GoogleAuth({
      credentials: creds.service_account as any,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    }) as any;
    return google.calendar({ version: 'v3', auth });
  }
  const auth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  auth.setCredentials({ refresh_token: creds.refresh_token ?? null });
  return google.calendar({ version: 'v3', auth });
}

async function loadCreds(tenantId: string): Promise<GoogleCalendarCredentials> {
  return getCredentialJson<GoogleCalendarCredentials>(tenantId, 'google_calendar');
}

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Google Calendar API timeout after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

/**
 * Creates the 5 Google Calendar tools, scoped to the given tenant via closure.
 * Safe to include in createTenantTools when 'google_calendar' is in active_tools.
 */
export function createCalendarTools(tenantId: string, _config: TenantConfig): ToolSet {
  return {
    buscarJanelasDisponiveis: tool({
      description:
        'Busca horários disponíveis no Google Calendar para agendamento. ' +
        'Use quando o usuário quiser saber quando pode agendar.',
      parameters: z.object({
        data_inicio: z.string().describe('Data início no formato ISO 8601 (ex: 2026-04-15T08:00:00-03:00)'),
        data_fim: z.string().describe('Data fim no formato ISO 8601 (ex: 2026-04-15T18:00:00-03:00)'),
        duracao_minutos: z
          .number()
          .optional()
          .describe('Duração do agendamento em minutos (padrão: 30)'),
      }),
      execute: async ({ data_inicio, data_fim, duracao_minutos }) => {
        try {
          const creds = await loadCreds(tenantId);
          const calendar = getCalendarClient(creds);
          const calendarId = creds.calendar_id ?? 'primary';
          const duration = duracao_minutos ?? creds.duration_minutes ?? 30;

          const { data } = await withTimeout(
            calendar.freebusy.query({
              requestBody: {
                timeMin: data_inicio,
                timeMax: data_fim,
                items: [{ id: calendarId }],
              },
            }),
          );

          const busy = data.calendars?.[calendarId]?.busy ?? [];

          // Calculate free slots based on busy periods
          const slots: Array<{ inicio: string; fim: string }> = [];
          let current = new Date(data_inicio);
          const end = new Date(data_fim);

          while (current < end) {
            const slotEnd = new Date(current.getTime() + duration * 60_000);
            if (slotEnd > end) break;

            const isBusy = busy.some((b) => {
              const bStart = new Date(b.start ?? '');
              const bEnd = new Date(b.end ?? '');
              return current < bEnd && slotEnd > bStart;
            });

            if (!isBusy) {
              slots.push({
                inicio: current.toISOString(),
                fim: slotEnd.toISOString(),
              });
            }

            current = new Date(current.getTime() + duration * 60_000);
          }

          return { slots: slots.slice(0, 10) }; // max 10 options
        } catch (err) {
          return { error: `Erro ao buscar disponibilidade: ${String(err)}` };
        }
      },
    }),

    criarAgendamento: tool({
      description: 'Cria um agendamento no Google Calendar.',
      parameters: z.object({
        titulo: z.string().describe('Título do evento'),
        data_inicio: z.string().describe('Data/hora início ISO 8601'),
        data_fim: z.string().optional().describe('Data/hora fim ISO 8601 (se omitido, usa duração padrão)'),
        descricao: z.string().optional().describe('Descrição do evento'),
        email_convidado: z.string().optional().describe('Email do contato a convidar'),
      }),
      execute: async ({ titulo, data_inicio, data_fim, descricao, email_convidado }) => {
        try {
          const creds = await loadCreds(tenantId);
          const calendar = getCalendarClient(creds);
          const calendarId = creds.calendar_id ?? 'primary';
          const duration = creds.duration_minutes ?? 30;

          const endTime = data_fim ?? new Date(
            new Date(data_inicio).getTime() + duration * 60_000,
          ).toISOString();

          const attendees = email_convidado ? [{ email: email_convidado }] : [];

          const { data } = await withTimeout(
            calendar.events.insert({
              calendarId,
              requestBody: {
                summary: titulo,
                description: descricao ?? null,
                start: { dateTime: data_inicio },
                end: { dateTime: endTime },
                attendees,
                reminders: {
                  useDefault: false,
                  overrides: [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                  ],
                },
              },
            }),
          );

          return {
            id: data.id,
            titulo: data.summary,
            inicio: data.start?.dateTime,
            fim: data.end?.dateTime,
            link: data.htmlLink,
          };
        } catch (err) {
          return { error: `Erro ao criar agendamento: ${String(err)}` };
        }
      },
    }),

    buscarAgendamentosContato: tool({
      description: 'Busca agendamentos futuros de um contato pelo email.',
      parameters: z.object({
        email_contato: z.string().describe('Email do contato'),
        max_resultados: z.number().optional().describe('Máximo de resultados (padrão: 5)'),
      }),
      execute: async ({ email_contato, max_resultados }) => {
        try {
          const creds = await loadCreds(tenantId);
          const calendar = getCalendarClient(creds);
          const calendarId = creds.calendar_id ?? 'primary';

          const { data } = await withTimeout(
            calendar.events.list({
              calendarId,
              timeMin: new Date().toISOString(),
              maxResults: max_resultados ?? 5,
              singleEvents: true,
              orderBy: 'startTime',
              q: email_contato,
            }),
          );

          const events = (data.items ?? []).map((e) => ({
            id: e.id,
            titulo: e.summary,
            inicio: e.start?.dateTime ?? e.start?.date,
            fim: e.end?.dateTime ?? e.end?.date,
            status: e.status,
          }));

          return { agendamentos: events };
        } catch (err) {
          return { error: `Erro ao buscar agendamentos: ${String(err)}` };
        }
      },
    }),

    cancelarAgendamento: tool({
      description: 'Cancela um agendamento pelo ID do evento.',
      parameters: z.object({
        event_id: z.string().describe('ID do evento no Google Calendar'),
        motivo: z.string().optional().describe('Motivo do cancelamento'),
      }),
      execute: async ({ event_id, motivo }) => {
        try {
          const creds = await loadCreds(tenantId);
          const calendar = getCalendarClient(creds);
          const calendarId = creds.calendar_id ?? 'primary';

          await withTimeout(
            calendar.events.delete({ calendarId, eventId: event_id }),
          );

          console.log(`[zenya] Calendar event ${event_id} cancelled by tenant=${tenantId} motivo=${motivo ?? ''}`);
          return { cancelado: true, event_id };
        } catch (err) {
          return { error: `Erro ao cancelar agendamento: ${String(err)}` };
        }
      },
    }),

    atualizarAgendamento: tool({
      description: 'Atualiza data/hora ou título de um agendamento existente.',
      parameters: z.object({
        event_id: z.string().describe('ID do evento no Google Calendar'),
        novo_inicio: z.string().optional().describe('Nova data/hora início ISO 8601'),
        novo_fim: z.string().optional().describe('Nova data/hora fim ISO 8601'),
        novo_titulo: z.string().optional().describe('Novo título do evento'),
        nova_descricao: z.string().optional().describe('Nova descrição'),
      }),
      execute: async ({ event_id, novo_inicio, novo_fim, novo_titulo, nova_descricao }) => {
        try {
          const creds = await loadCreds(tenantId);
          const calendar = getCalendarClient(creds);
          const calendarId = creds.calendar_id ?? 'primary';

          const patch: Record<string, unknown> = {};
          if (novo_titulo) patch['summary'] = novo_titulo;
          if (nova_descricao) patch['description'] = nova_descricao;
          if (novo_inicio) patch['start'] = { dateTime: novo_inicio };
          if (novo_fim) patch['end'] = { dateTime: novo_fim };

          const { data } = await withTimeout(
            calendar.events.patch({ calendarId, eventId: event_id, requestBody: patch }),
          );

          return {
            atualizado: true,
            id: data.id,
            inicio: data.start?.dateTime,
            fim: data.end?.dateTime,
            titulo: data.summary,
          };
        } catch (err) {
          return { error: `Erro ao atualizar agendamento: ${String(err)}` };
        }
      },
    }),
  };
}
