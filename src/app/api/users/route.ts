import { connection, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { listWebhookProfiles } from '@/lib/webhook-keys';

const DATA_FILE = path.join(process.cwd(), 'data', 'events.json');
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

type StoredEvent = {
  eventType?: string;
  totalRuns?: string;
  result?: string;
  drops?: unknown[];
  profile?: {
    displayName?: string;
    avatarUrl?: string;
  };
};

function containsFarmData(events: StoredEvent[]) {
  return events.some((event) => {
    const eventType = event.eventType?.toLowerCase() ?? '';
    return Boolean(
      event.totalRuns ||
      event.result ||
      event.drops?.length ||
      eventType.includes('run finished') ||
      eventType.includes('rejoined') ||
      eventType.includes('server closed'),
    );
  });
}

export async function GET() {
  await connection();
  let data: Record<string, StoredEvent[]> = {};

  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      data = JSON.parse(content || '{}') as Record<string, StoredEvent[]>;
    }
  } catch (err) {
    console.error('Failed to get users:', err);
  }

  const usersById = new Map<string, {
    name: string;
    displayName: string;
    avatarUrl: string | null;
    hasEvents: boolean;
  }>();

  for (const [user, events] of Object.entries(data)) {
    if (user.startsWith('user_') || !Array.isArray(events) || !containsFarmData(events)) continue;
    const profile = events.find((event) => event.profile)?.profile;
    usersById.set(user, {
      name: user,
      displayName: profile?.displayName || user,
      avatarUrl: profile?.avatarUrl || null,
      hasEvents: true,
    });
  }

  for (const profile of listWebhookProfiles()) {
    const existing = usersById.get(profile.publicId);
    usersById.set(profile.publicId, {
      name: profile.publicId,
      displayName: profile.displayName,
      avatarUrl: existing?.avatarUrl || null,
      hasEvents: existing?.hasEvents || false,
    });
  }

  const users = Array.from(usersById.values());
  return NextResponse.json(
    {
      success: true,
      users,
      latestUser: users[0]?.name || null,
    },
    { headers: NO_STORE_HEADERS },
  );
}
