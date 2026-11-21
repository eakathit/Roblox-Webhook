import { NextRequest, NextResponse } from 'next/server';
import { createWebhookKey } from '@/lib/webhook-keys';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

function publicOrigin(request: NextRequest) {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    return `https://${railwayDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProtocol}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 4096) {
    return NextResponse.json({ success: false, error: 'Request is too large' }, { status: 413 });
  }

  const body = await request.json().catch(() => null) as { displayName?: unknown } | null;
  const displayName = typeof body?.displayName === 'string'
    ? body.displayName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40)
    : '';

  if (displayName.length < 2) {
    return NextResponse.json(
      { success: false, error: 'กรุณาใส่ชื่ออย่างน้อย 2 ตัวอักษร' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { record, writeKey } = createWebhookKey(displayName);
  const origin = publicOrigin(request);

  return NextResponse.json(
    {
      success: true,
      publicId: record.publicId,
      endpointUrl: `${origin}/api/webhooks/1350000000000000000/${writeKey}`,
      dashboardUrl: `${origin}/?user=${encodeURIComponent(record.publicId)}`,
    },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
