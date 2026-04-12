// NuvemShop Blog Publisher — Story 5.3
// Publishes approved content posts to NuvemShop blog via their API
// Converts Markdown body to HTML before sending

import { updateContentPost } from '@sparkle-os/core';
import type { ContentPost } from '@sparkle-os/core';

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

export async function getNuvemShopImageUrl(
  topic: string | null,
  accessToken: string,
  userId: string,
): Promise<string | null> {
  const query = topic
    ? `?q=${encodeURIComponent(topic)}&per_page=1`
    : '?per_page=1&sort_by=updated_at&sort_dir=desc';

  let response: Response;
  try {
    response = await fetch(`https://api.tiendanube.com/v1/${userId}/products${query}`, {
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': 'SparkleOS/1.0 (contentengine@sparkle.com)',
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const products = (await response.json()) as Array<{ images?: Array<{ src: string }> }>;
  return products[0]?.images?.[0]?.src ?? null;
}

export async function publishToNuvemShop(post: ContentPost): Promise<void> {
  const accessToken = process.env['NUVEMSHOP_ACCESS_TOKEN'];
  const userId = process.env['NUVEMSHOP_USER_ID'];
  const blogId = process.env['NUVEMSHOP_BLOG_ID'] ?? '1';

  if (!accessToken || !userId) {
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: 'NUVEMSHOP_ACCESS_TOKEN ou NUVEMSHOP_USER_ID não configurado',
    });
    return;
  }

  const bodyHtml = post.bodyFull
    ? markdownToHtml(post.bodyFull)
    : post.bodyPreview
      ? markdownToHtml(post.bodyPreview)
      : '';

  const imageUrl = await getNuvemShopImageUrl(post.topic, accessToken, userId);

  const articleBody: Record<string, unknown> = {
    title: { pt: post.title ?? '(sem título)' },
    content: { pt: bodyHtml },
    ...(post.meta ? { meta_description: { pt: post.meta } } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`https://api.tiendanube.com/v1/${userId}/blogs/${blogId}/articles`, {
      method: 'POST',
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': 'SparkleOS/1.0 (contentengine@sparkle.com)',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(articleBody),
    });
  } catch (err) {
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: `Falha de rede ao publicar no NuvemShop: ${String(err)}`,
    });
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => String(response.status));
    await updateContentPost(post.id, {
      status: 'erro_publicacao',
      errorMsg: `NuvemShop API error ${response.status}: ${errText.slice(0, 200)}`,
    });
    return;
  }

  const article = (await response.json()) as { id: number; url?: string };
  const blogUrl =
    article.url ??
    `https://api.tiendanube.com/v1/${userId}/blogs/${blogId}/articles/${article.id}`;

  await updateContentPost(post.id, {
    status: 'publicado',
    blogUrl,
    publishedAt: new Date(),
  });
}
