// Pinterest Publisher — Story 5.4
// Creates pins on Pinterest via API v5
// NOTE: Failure does NOT block blog publication — independent step

import { updateContentPost } from '@sparkle-os/core';
import type { ContentPost } from '@sparkle-os/core';
import { getDriveImageAsBase64 } from './drive-client.js';

export function extractDriveFileId(url: string): string | null {
  // Matches /file/d/{id}/ or /d/{id}/ or id={id}
  const byPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1] ?? null;
  const byParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return byParam?.[1] ?? null;
}

export async function publishToPinterest(post: ContentPost): Promise<void> {
  const accessToken = process.env['PINTEREST_ACCESS_TOKEN'];
  const boardId = process.env['PINTEREST_BOARD_ID'];

  if (!accessToken || !boardId) {
    await updateContentPost(post.id, {
      status: 'erro_pin',
      errorMsg: 'PINTEREST_ACCESS_TOKEN ou PINTEREST_BOARD_ID não configurado',
    });
    return;
  }

  // Fetch image from Drive
  let mediaSource: Record<string, string> | null = null;

  if (post.imageDriveUrl) {
    const fileId = extractDriveFileId(post.imageDriveUrl);
    if (fileId) {
      const imageData = await getDriveImageAsBase64(fileId).catch(() => null);
      if (imageData) {
        mediaSource = {
          source_type: 'image_base64',
          content_type: imageData.mimeType,
          data: imageData.base64,
        };
      }
    }
  }

  if (!mediaSource) {
    await updateContentPost(post.id, {
      status: 'erro_pin',
      errorMsg: 'Imagem do Drive não disponível para publicação do pin',
    });
    return;
  }

  const description = [post.pinCopy, post.pinHashtags].filter(Boolean).join('\n');

  const pinBody: Record<string, unknown> = {
    board_id: boardId,
    title: post.title ?? '',
    description,
    media_source: mediaSource,
    ...(post.blogUrl ? { link: post.blogUrl } : {}),
  };

  let response: Response;
  try {
    response = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinBody),
    });
  } catch (err) {
    await updateContentPost(post.id, {
      status: 'erro_pin',
      errorMsg: `Falha de rede ao publicar no Pinterest: ${String(err)}`,
    });
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => String(response.status));
    await updateContentPost(post.id, {
      status: 'erro_pin',
      errorMsg: `Pinterest API error ${response.status}: ${errText.slice(0, 200)}`,
    });
    return;
  }

  const pin = (await response.json()) as { id: string };
  const pinUrl = `https://pinterest.com/pin/${pin.id}`;

  await updateContentPost(post.id, {
    status: 'pin_publicado',
    pinUrl,
  });
}
