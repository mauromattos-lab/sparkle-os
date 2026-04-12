import type { PostStatus } from '../db/schema.js';

export type { PostStatus };

export interface ContentPost {
  id: string;
  clientId: string;
  status: PostStatus;
  topic: string | null;
  title: string | null;
  meta: string | null;
  bodyPreview: string | null;
  bodyFull: string | null;
  imageDesc: string | null;
  pinCopy: string | null;
  pinHashtags: string | null;
  imageDriveUrl: string | null;
  blogUrl: string | null;
  pinUrl: string | null;
  errorMsg: string | null;
  rejectionNote: string | null;
  createdAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
}

export interface CreateContentPostInput {
  clientId?: string;
  topic?: string;
}

export interface UpdateContentPostInput {
  status?: PostStatus;
  topic?: string;
  title?: string;
  meta?: string;
  bodyPreview?: string;
  bodyFull?: string;
  imageDesc?: string;
  pinCopy?: string;
  pinHashtags?: string;
  imageDriveUrl?: string;
  blogUrl?: string;
  pinUrl?: string;
  errorMsg?: string;
  rejectionNote?: string;
  approvedAt?: Date;
  publishedAt?: Date;
}
