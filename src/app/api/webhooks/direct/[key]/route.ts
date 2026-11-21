import { NextRequest, NextResponse } from 'next/server';
import { directWebhookCorsHeaders, handleDirectWebhook } from '@/lib/direct-webhook-route';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: directWebhookCorsHeaders });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  return handleDirectWebhook(request, key);
}
