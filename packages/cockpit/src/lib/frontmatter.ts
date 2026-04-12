// Frontmatter helper — shared utility for parsing YAML frontmatter blocks
// Extracted to avoid duplication across service files (agent-activity, zenya, stories-parser)

/**
 * Parses a YAML frontmatter block (between --- delimiters) from a Markdown file.
 * Returns key-value pairs as a flat string record.
 * Arrays and multi-line values are not supported — only scalar values.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = value;
  }
  return result;
}
