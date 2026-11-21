import { NextRequest, NextResponse } from 'next/server';
import { getEventsByToken, parseDiscordPayload, saveEvent, clearEventsByToken } from '@/lib/store';
import { handleDirectWebhook } from '@/lib/direct-webhook-route';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Extract token from slug (e.g. ['user_123'] -> 'user_123' or ['99999', 'user_123'] -> 'user_123')
function extractToken(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return 'default';
  return slug[slug.length - 1];
}

// GET /api/webhooks/[...slug]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const token = extractToken(slug);
  const events = getEventsByToken(token);

  return NextResponse.json(
    {
      success: true,
      token,
      count: events.length,
      events,
    },
    { headers: corsHeaders }
  );
}

// POST /api/webhooks/[...slug]
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  if (slug?.length === 2 && /^\d{17,20}$/.test(slug[0])) {
    return handleDirectWebhook(request, slug[1]);
  }
  const token = extractToken(slug);

  let payload: unknown = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      const rawText = await request.text();
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = { text: rawText };
      }
    }
  } catch (err: unknown) {
    console.error('Error parsing request body:', err);
    payload = {
      error: 'Failed to parse body',
      raw: err instanceof Error ? err.message : 'Unknown request error',
    };
  }

  const parsedEvent = parseDiscordPayload(token, payload);
  saveEvent(token, parsedEvent);

  console.log(`[Webhook Intercepted] Token: ${token} | Event: ${parsedEvent.eventType}`);

  return NextResponse.json(
    {
      success: true,
      message: 'Webhook payload received and captured successfully',
      event: parsedEvent,
    },
    {
      status: 200,
      headers: corsHeaders,
    }
  );
}

// DELETE /api/webhooks/[...slug]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const token = extractToken(slug);
  clearEventsByToken(token);

  return NextResponse.json(
    {
      success: true,
      message: 'Events cleared successfully',
    },
    { headers: corsHeaders }
  );
}
