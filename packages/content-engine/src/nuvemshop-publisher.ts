// NuvemShop Blog Publisher — Story 5.3 (parcialmente depreciado — Story 6.4)
// publishToNuvemShop e getNuvemShopImageUrl removidos — canal de blog migrado para Ghost (Story 6.2)
// markdownToHtml mantida — importada por ghost-publisher.ts

export function markdownToHtml(markdown: string): string {
  return (
    markdown
      // Headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Unordered list items
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/(<li>(?:.|\n)*?<\/li>(?:\n<li>(?:.|\n)*?<\/li>)*)/g, '<ul>$1</ul>')
      // Double newline → paragraph break
      .replace(/\n\n/g, '</p><p>')
      // Trim and wrap remaining plain text paragraphs
      .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .trim()
  );
}

