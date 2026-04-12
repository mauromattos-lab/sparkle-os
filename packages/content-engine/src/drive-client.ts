// Google Drive Client — Story 5.5
// Selects images from a shared Drive folder via Google Drive API v3
// Auth: Service Account via JWT bearer flow

import { createSign } from 'crypto';

interface GoogleServiceAccountKey {
  type: string;
  client_email: string;
  private_key: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export function buildJwt(serviceAccountKey: GoogleServiceAccountKey, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  ).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(serviceAccountKey.private_key, 'base64url');

  return `${signingInput}.${signature}`;
}

export async function getGoogleAccessToken(serviceAccountKey: GoogleServiceAccountKey): Promise<string> {
  const jwt = buildJwt(serviceAccountKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

export async function listDriveImages(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: 'files(id,name,mimeType,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: '20',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Drive files.list failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

export async function downloadDriveFileAsBase64(
  fileId: string,
  accessToken: string,
): Promise<{ base64: string; mimeType: string }> {
  const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Drive file metadata failed: ${metaResponse.status}`);
  }
  const meta = (await metaResponse.json()) as { mimeType: string };

  const dlResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!dlResponse.ok) {
    throw new Error(`Drive file download failed: ${dlResponse.status}`);
  }

  const arrayBuffer = await dlResponse.arrayBuffer();
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mimeType: meta.mimeType };
}

export interface DriveImageResult {
  fileId: string;
  fileName: string;
  mimeType: string;
}

export async function selectDriveImage(topic?: string | null): Promise<DriveImageResult | null> {
  const folderId = process.env['GOOGLE_DRIVE_FOLDER_ID'];
  const keyJson = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];

  if (!folderId || !keyJson) {
    console.warn('[drive-client] GOOGLE_DRIVE_FOLDER_ID ou GOOGLE_SERVICE_ACCOUNT_KEY não configurado');
    return null;
  }

  let serviceAccountKey: GoogleServiceAccountKey;
  try {
    serviceAccountKey = JSON.parse(keyJson) as GoogleServiceAccountKey;
  } catch {
    console.error('[drive-client] GOOGLE_SERVICE_ACCOUNT_KEY JSON inválido');
    return null;
  }

  const accessToken = await getGoogleAccessToken(serviceAccountKey);
  const files = await listDriveImages(folderId, accessToken);

  if (files.length === 0) {
    console.warn('[drive-client] Pasta do Drive vazia ou sem imagens');
    return null;
  }

  if (topic) {
    const topicLower = topic.toLowerCase();
    const match = files.find((f) => f.name.toLowerCase().includes(topicLower));
    if (match) return { fileId: match.id, fileName: match.name, mimeType: match.mimeType };
  }

  const first = files[0];
  if (!first) return null;
  return { fileId: first.id, fileName: first.name, mimeType: first.mimeType };
}

export async function getDriveImageAsBase64(fileId: string): Promise<{ base64: string; mimeType: string } | null> {
  const keyJson = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];
  if (!keyJson) return null;

  let serviceAccountKey: GoogleServiceAccountKey;
  try {
    serviceAccountKey = JSON.parse(keyJson) as GoogleServiceAccountKey;
  } catch {
    return null;
  }

  const accessToken = await getGoogleAccessToken(serviceAccountKey);
  return downloadDriveFileAsBase64(fileId, accessToken);
}
