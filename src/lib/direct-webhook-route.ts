import { NextRequest, NextResponse } from 'next/server';
import { findWebhookKey } from '@/lib/webhook-keys';
import { parseDiscordPayload, saveEvent } from '@/lib/store';

export const directWebhookCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, max-age=0',
};

export async function handleDirectWebhook(request: NextRequest, key: string) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 65536) {
    return NextResponse.json(
      { success: false, error: 'Payload is too large' },
      { status: 413, headers: directWebhookCorsHeaders },
    );
  }

  const keyRecord = findWebhookKey(key);
  if (!keyRecord) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook key' },
      { status: 404, headers: directWebhookCorsHeaders },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: 'Expected a JSON object' },
      { status: 400, headers: directWebhookCorsHeaders },
    );
  }

  const payload = {
    ...(body as Record<string, unknown>),
    trackerProfile: { displayName: keyRecord.displayName },
  };
  const event = parseDiscordPayload(keyRecord.publicId, payload);
  saveEvent(keyRecord.publicId, event);

  return NextResponse.json(
    {
      success: true,
      eventId: event.id,
      dashboardPath: `/?user=${encodeURIComponent(keyRecord.publicId)}`,
    },
    { status: 201, headers: directWebhookCorsHeaders },
  );
}
