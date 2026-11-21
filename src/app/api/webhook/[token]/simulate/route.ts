import { NextRequest, NextResponse } from 'next/server';
import { parseDiscordPayload, saveEvent } from '@/lib/store';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({})) as { type?: string };
  const type = body.type || 'run'; // 'test' | 'run' | 'rare'

  let mockPayload: unknown;

  if (type === 'test') {
    mockPayload = {
      content: '<@123456789>',
      embeds: [
        {
          title: 'Macro Webhook Test',
          description: 'Connection successful! Webhook is working properly.',
          color: 65280,
          fields: [
            { name: 'Status', value: 'Connected & Active', inline: true },
            { name: 'Session Duration', value: '00:01:25', inline: true },
            { name: 'Game', value: 'Anime Crusaders X', inline: true }
          ],
          footer: { text: 'Anime Crusaders X Macro • Test Mode' },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else if (type === 'rare') {
    mockPayload = {
      content: '<@123456789> **✨ RARE DROP DETECTED! ✨**',
      embeds: [
        {
          title: '✨ RARE DROP NOTIFICATION ✨',
          description: 'A rare item/unit has dropped during your macro run!',
          color: 16766720,
          fields: [
            { name: 'Result', value: 'Victory (Wave 20 - Boss Cleared)', inline: true },
            { name: 'Match Duration', value: '5m 45s', inline: true },
            { name: 'Total Runs', value: '45 (100% Win Rate)', inline: true },
            { name: 'Gems & Gold', value: '+3,500 Gems | +120,000 Gold', inline: false },
            {
              name: 'Drops',
              value: '✨ Shiny Mythic Sung Jinwoo (Secret), 2x Mythic Crystal, 5x Evolution Token',
              inline: false
            },
            { name: 'Wave Reached', value: 'Wave 20', inline: true },
            { name: 'Routine Task', value: 'Auto-Story Farm Act 4', inline: true }
          ],
          footer: { text: 'Anime Crusaders X Macro' },
          timestamp: new Date().toISOString()
        }
      ]
    };
  } else {
    // Normal run finished
    const runNum = Math.floor(Math.random() * 50) + 1;
    const gems = Math.floor(Math.random() * 800) + 500;
    const gold = Math.floor(Math.random() * 20000) + 15000;
    mockPayload = {
      content: '',
      embeds: [
        {
          title: 'Run Finished',
          description: `Run #${runNum} has completed successfully.`,
          color: 3447003,
          fields: [
            { name: 'Result', value: 'Victory (Wave 15)', inline: true },
            { name: 'Match Duration', value: '3m 48s', inline: true },
            { name: 'Total Runs', value: `${runNum} (100%)`, inline: true },
            { name: 'Daily Runs', value: `${runNum} / 100`, inline: true },
            { name: 'Gems & Gold', value: `+${gems.toLocaleString()} Gems | +${gold.toLocaleString()} Gold`, inline: false },
            {
              name: 'Drops',
              value: '1x Epic Capsule, 4x Gold Bar, 12x Star Dust',
              inline: false
            },
            { name: 'Time Elapsed', value: '1h 24m', inline: true },
            { name: 'Est. Time Left', value: '2h 36m', inline: true }
          ],
          footer: { text: 'Anime Crusaders X Macro' },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  const parsed = parseDiscordPayload(token, mockPayload);
  saveEvent(token, parsed);

  return NextResponse.json({
    success: true,
    message: 'Simulated webhook event dispatched',
    event: parsed,
  });
}
