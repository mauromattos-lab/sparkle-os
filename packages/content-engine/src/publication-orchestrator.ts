// Publication Orchestrator — Stories 5.3 + 5.4 + 5.5
// Coordinates the full publication pipeline triggered after post approval
// Order: Drive image selection → NuvemShop blog → Pinterest pin (non-blocking)

import { getContentPost, updateContentPost } from '@sparkle-os/core';
import { selectDriveImage } from './drive-client.js';
import { publishToNuvemShop } from './nuvemshop-publisher.js';
import { publishToPinterest } from './pinterest-publisher.js';

export async function triggerPublication(postId: string): Promise<void> {
  const post = await getContentPost(postId);
  if (!post) {
    console.error(`[publication-orchestrator] Post ${postId} não encontrado`);
    return;
  }

  // Step 1 (Story 5.5): Select image from Google Drive
  if (!post.imageDriveUrl) {
    const driveImage = await selectDriveImage(post.topic).catch((err: unknown) => {
      console.warn('[publication-orchestrator] Drive image selection failed (non-blocking):', err);
      return null;
    });

    if (driveImage) {
      await updateContentPost(postId, {
        imageDriveUrl: `https://drive.google.com/file/d/${driveImage.fileId}/view`,
      });
    }
  }

  // Re-fetch post with updated imageDriveUrl
  const postWithImage = await getContentPost(postId);
  if (!postWithImage) return;

  // Step 2 (Story 5.3): Publish to NuvemShop blog
  await publishToNuvemShop(postWithImage);

  // Re-fetch to get blogUrl for the Pinterest pin link
  const postWithBlog = await getContentPost(postId);
  if (!postWithBlog) return;

  // Step 3 (Story 5.4): Publish Pinterest pin — failure does NOT block blog
  await publishToPinterest(postWithBlog).catch((err: unknown) => {
    console.error('[publication-orchestrator] Pinterest step failed (non-blocking):', err);
  });
}
