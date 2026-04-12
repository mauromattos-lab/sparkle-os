#!/usr/bin/env node
// aiox CLI — SparkleOS AI-Orchestrated System command-line interface
// Usage: aiox <command> [subcommand] [options]
//
// Commands:
//   brain add  Ingest external knowledge into the Collective Brain (mauro_input)
//
// Story 3.6: implements 'aiox brain add' for knowledge ingestion by Mauro

'use strict';

const args = process.argv.slice(2);
const [command, subcommand, ...rest] = args;

// ─── brain add ───────────────────────────────────────────────────────────────

if (command === 'brain' && subcommand === 'add') {
  await runBrainAdd(rest);
} else if (command === 'brain' && !subcommand) {
  console.error('Usage: aiox brain <subcommand>');
  console.error('  add  Ingest external knowledge into the Collective Brain');
  process.exit(1);
} else if (!command) {
  console.error('Usage: aiox <command> [subcommand] [options]');
  console.error('Commands: brain');
  process.exit(1);
} else {
  console.error(`Unknown command: ${command} ${subcommand ?? ''}`);
  console.error('Run "aiox --help" or "aiox brain add --help" for usage.');
  process.exit(1);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse --flag value or --flag=value from argv array.
 * Returns { flags: Record<string, string>, positional: string[] }
 */
function parseFlags(argv) {
  const flags = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        // --key=value
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        flags[key] = value;
      } else {
        // --key value
        const key = arg.slice(2);
        const nextArg = argv[i + 1];
        if (nextArg !== undefined && !nextArg.startsWith('--')) {
          flags[key] = nextArg;
          i++;
        } else {
          flags[key] = 'true'; // boolean flag
        }
      }
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { flags, positional };
}

/**
 * aiox brain add — ingest external knowledge into the Collective Brain.
 * Sends POST /brain/insights/ingest with source='mauro_input'.
 */
async function runBrainAdd(argv) {
  const { flags } = parseFlags(argv);

  // --help
  if (flags['help'] || flags['h']) {
    console.log(`
aiox brain add — Ingest external knowledge into the Collective Brain

Usage:
  aiox brain add --content "<text>" [options]

Options:
  --content   <string>  Knowledge text to ingest (required, max 2000 chars)
  --tags      <string>  Comma-separated tags (e.g. "whatsapp,canal,preferencia")
  --summary   <string>  Short summary for display (max 200 chars)
  --sourceRef <string>  Reference for traceability (e.g. "conversa:2026-04-12")

Environment:
  BRAIN_URL   Brain service URL (default: http://localhost:3003)

Examples:
  aiox brain add --content "Clientes preferem WhatsApp a e-mail" --tags "canal,preferencia"
  aiox brain add --content "Padrão de abandono" --sourceRef "conversa:2026-04-12" --summary "Abandono em 3 perguntas"
`);
    process.exit(0);
  }

  // Validate required --content
  const content = flags['content'];
  if (!content) {
    console.error('Error: --content is required.');
    console.error('Usage: aiox brain add --content "<text>" [--tags csv] [--summary text] [--sourceRef ref]');
    process.exit(1);
  }

  // Build request body
  const body = {
    source: 'mauro_input',
    content,
  };

  if (flags['tags']) {
    body.tags = flags['tags'].split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (flags['summary']) {
    body.summary = flags['summary'];
  }
  if (flags['sourceRef']) {
    body.sourceRef = flags['sourceRef'];
  }

  // Brain service URL from env (default: http://localhost:3003)
  const brainUrl = (process.env['BRAIN_URL'] ?? 'http://localhost:3003').replace(/\/$/, '');
  const endpoint = `${brainUrl}/brain/insights/ingest`;

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Error: Could not connect to Brain service at ${brainUrl}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    console.error('Is the Brain service running? Set BRAIN_URL to override the default URL.');
    process.exit(1);
  }

  let responseBody;
  try {
    responseBody = await res.json();
  } catch {
    console.error(`Error: Brain service returned non-JSON response (HTTP ${res.status})`);
    process.exit(1);
  }

  if (!res.ok) {
    const errMsg = responseBody?.error ?? `HTTP ${res.status}`;
    console.error(`Error: ${errMsg}`);
    process.exit(1);
  }

  const insight = responseBody;

  console.log('Insight ingested');
  console.log(`  id:             ${insight.id}`);
  console.log(`  source:         ${insight.source}`);
  console.log(`  confidenceLevel: ${insight.confidenceLevel}`);
  console.log(`  status:         ${insight.status}`);
  if (insight.sourceRef) {
    console.log(`  sourceRef:      ${insight.sourceRef}`);
  }
  if (insight.tags && insight.tags.length > 0) {
    console.log(`  tags:           ${insight.tags.join(', ')}`);
  }
}
