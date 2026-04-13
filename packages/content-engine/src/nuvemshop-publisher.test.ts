// Unit tests for NuvemShop Publisher — Story 5.3 (atualizado Story 6.4)
// publishToNuvemShop e getNuvemShopImageUrl removidos — canal migrado para Ghost (Story 6.2)
// Apenas markdownToHtml permanece — importada por ghost-publisher.ts

import { describe, it, expect } from 'vitest';
import { markdownToHtml } from './nuvemshop-publisher.js';

describe('markdownToHtml', () => {
  it('converts headings', () => {
    expect(markdownToHtml('# H1\n## H2\n### H3')).toContain('<h1>H1</h1>');
    expect(markdownToHtml('# H1\n## H2\n### H3')).toContain('<h2>H2</h2>');
    expect(markdownToHtml('# H1\n## H2\n### H3')).toContain('<h3>H3</h3>');
  });

  it('converts bold and italic', () => {
    expect(markdownToHtml('**bold** and *italic*')).toContain('<strong>bold</strong>');
    expect(markdownToHtml('**bold** and *italic*')).toContain('<em>italic</em>');
  });

  it('converts links', () => {
    const html = markdownToHtml('[Plaka](https://plaka.com)');
    expect(html).toContain('<a href="https://plaka.com">Plaka</a>');
  });
});
