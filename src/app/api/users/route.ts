import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(content || '{}') as Record<string, StoredEvent[]>;
      const users = Object.entries(data)
        .filter(([user, events]) =>
          !user.startsWith('user_') && Array.isArray(events) && containsFarmData(events),
        )
        .map(([user, events]) => {
          const profile = events.find((event) => event.profile)?.profile;
          return {
            name: user,
            displayName: profile?.displayName || user,
            avatarUrl: profile?.avatarUrl || null,
          };
        });

      return NextResponse.json(
        {
          success: true,
          users,
          latestUser: users[0]?.name || null,
        },
        { headers: NO_STORE_HEADERS },
      );
    }
  } catch (err) {
    console.error('Failed to get users:', err);
  }

  return NextResponse.json(
    {
      success: true,
      users: [],
      latestUser: null,
    },
    { headers: NO_STORE_HEADERS },
  );
}
