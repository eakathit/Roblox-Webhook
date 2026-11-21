import { NextRequest, NextResponse } from 'next/server';
import { getEventsByToken, parseDiscordPayload, saveEvent, clearEventsByToken } from '@/lib/store';

// Helper for CORS headers
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

// GET /api/webhook/[token] -> List all events for this token
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
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

// POST /api/webhook/[token] -> Webhook Endpoint (Roblox Macro sends here)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

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

  // Parse payload according to Discord Embed / Macro standard
  const parsedEvent = parseDiscordPayload(token, payload);
  saveEvent(token, parsedEvent);

  console.log(`[Webhook Received] Token: ${token} | Event: ${parsedEvent.eventType}`);

  // Discord webhooks respond with 204 or 200
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

// DELETE /api/webhook/[token] -> Clear all events for this token
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  clearEventsByToken(token);

  return NextResponse.json(
    {
      success: true,
      message: 'Events cleared successfully',
    },
    { headers: corsHeaders }
  );
}
