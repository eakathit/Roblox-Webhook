import fs from 'fs';
import path from 'path';
import { matchCatalogEntry, type CatalogEntryType } from '@/lib/acx-catalog';

export interface DropItem {
  name: string;
  originalName?: string;
  quantity?: number;
  rarity?: 'secret' | 'mythic' | 'legendary' | 'epic' | 'rare' | 'shiny' | 'normal';
  catalogId?: string;
  catalogType?: CatalogEntryType;
  catalogRarity?: string;
  icon?: string;
  matchConfidence?: number;
}

interface DiscordEmbedField {
  name?: unknown;
  value?: unknown;
  inline?: unknown;
}

interface DiscordEmbed {
  title?: unknown;
  description?: unknown;
  fields?: DiscordEmbedField[];
}

interface DiscordWebhookPayload {
  embeds?: DiscordEmbed[];
  trackerProfile?: {
    displayName?: unknown;
    avatarUrl?: unknown;
    discordUserId?: unknown;
  };
  [key: string]: unknown;
}

export interface DiscordProfile {
  displayName?: string;
  avatarUrl?: string;
  discordUserId?: string;
}

export interface ParsedWebhookEvent {
  id: string;
  token: string;
  timestamp: string;
  eventType: string; // e.g. "Run Finished", "Rejoined (AFK protection)"
  mapName?: string; // e.g. "Raid · Liones Kingdom - Throne of Kings (Hard)"
  result?: string; // e.g. "Victory", "Defeat"
  wave?: string; // e.g. "20"
  duration?: string; // e.g. "8m 18s"
  timeElapsed?: string; // e.g. "4h 5m"
  totalRuns?: string; // e.g. "29"
  resultsSummary?: string; // e.g. "Wins: 29 | Losses: 0 [100%]"
  nextReset?: string; // e.g. "9h 23m"
  gems?: string; // e.g. "0"
  gold?: string; // e.g. "7,250"
  drops: DropItem[];
  fields: { name: string; value: string; inline?: boolean }[];
  rawPayload: unknown;
  profile?: DiscordProfile;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
  }
}

function readAllEvents(): Record<string, ParsedWebhookEvent[]> {
  try {
    ensureDataFile();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error('Failed to read events file:', err);
    return {};
  }
}

function writeAllEvents(data: Record<string, ParsedWebhookEvent[]>) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write events file:', err);
  }
}

export function getEventsByToken(token: string): ParsedWebhookEvent[] {
  const all = readAllEvents();
  return (all[token] || []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function saveEvent(token: string, event: ParsedWebhookEvent) {
  const all = readAllEvents();
  if (!all[token]) {
    all[token] = [];
  }
  all[token].unshift(event);
  if (all[token].length > 100) {
    all[token] = all[token].slice(0, 100);
  }
  writeAllEvents(all);
}

export function clearEventsByToken(token: string) {
  const all = readAllEvents();
  delete all[token];
  writeAllEvents(all);
}

// Precision parser tailored specifically for Anime Crusaders - Macro
export function parseDiscordPayload(token: string, payload: unknown): ParsedWebhookEvent {
  const eventId = 'evt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const timestamp = new Date().toISOString();

  let eventType = 'Anime Crusaders Event';
  let mapName = '';
  let result = '';
  let wave = '';
  let duration = '';
  let timeElapsed = '';
  let totalRuns = '';
  let resultsSummary = '';
  let nextReset = '';
  let gems = '';
  let gold = '';
  const drops: DropItem[] = [];
  const extractedFields: { name: string; value: string; inline?: boolean }[] = [];

  const webhookPayload = payload && typeof payload === 'object'
    ? payload as DiscordWebhookPayload
    : {};
  const rawProfile = webhookPayload.trackerProfile;
  let profile: DiscordProfile | undefined;

  if (rawProfile && typeof rawProfile === 'object') {
    const displayName = typeof rawProfile.displayName === 'string'
      ? rawProfile.displayName.trim().slice(0, 80)
      : '';
    const discordUserId = typeof rawProfile.discordUserId === 'string' && /^\d{15,22}$/.test(rawProfile.discordUserId)
      ? rawProfile.discordUserId
      : '';
    let avatarUrl = '';

    if (typeof rawProfile.avatarUrl === 'string') {
      try {
        const url = new URL(rawProfile.avatarUrl);
        if (url.protocol === 'https:' && url.hostname === 'cdn.discordapp.com') {
          avatarUrl = url.toString();
        }
      } catch {
        avatarUrl = '';
      }
    }

    if (displayName || discordUserId || avatarUrl) {
      profile = {
        displayName: displayName || undefined,
        discordUserId: discordUserId || undefined,
        avatarUrl: avatarUrl || undefined,
      };
    }
  }
  const embeds = Array.isArray(webhookPayload.embeds) ? webhookPayload.embeds : [];
  if (embeds.length > 0) {
    const embed = embeds[0];

    // Title parsing: e.g. "Run Finished [Victory]"
    if (typeof embed.title === 'string' && embed.title) {
      eventType = embed.title;
      const victoryMatch = embed.title.match(/\[(.*?)\]/);
      if (victoryMatch) {
        result = victoryMatch[1]; // "Victory" or "Defeat"
      }
    }

    // Description: e.g. "Raid · Liones Kingdom - Throne of Kings (Hard)"
    if (typeof embed.description === 'string' && embed.description) {
      mapName = embed.description;
    }

    if (Array.isArray(embed.fields)) {
      for (const field of embed.fields) {
        const name = String(field.name || '').trim();
        const value = String(field.value || '').trim();
        extractedFields.push({ name, value, inline: !!field.inline });

        const lowerName = name.toLowerCase();

        // 1. Time Elapsed
        if (lowerName.includes('time elapsed')) {
          timeElapsed = value;
        }

        // 2. Match Duration
        if (lowerName.includes('match duration') || lowerName.includes('duration')) {
          duration = value;
        }

        // 3. Wave Reached
        if (lowerName.includes('wave')) {
          wave = value;
        }

        // 4. Results: "Wins: 29 | Losses: 0 [100%]"
        if (lowerName === 'results' || lowerName.includes('result')) {
          resultsSummary = value;
          if (!result && value.toLowerCase().includes('win')) {
            result = 'Victory';
          }
        }

        // 5. Total Runs
        if (lowerName.includes('total run') || lowerName === 'runs') {
          totalRuns = value;
        }

        // 6. Next Reset
        if (lowerName.includes('reset')) {
          nextReset = value;
        }

        // 7. Gems · Gold: format "0 · 7,250"
        if (lowerName.includes('gem') || lowerName.includes('gold')) {
          const parts = value.split(/[·•|\-]/).map(p => p.trim());
          if (parts.length >= 2) {
            gems = parts[0] || '0';
            gold = parts[1] || '0';
          } else {
            const gemMatch = value.match(/([+\d,]+)\s*(?:gems|gem)/i);
            if (gemMatch) gems = gemMatch[1];
            const goldMatch = value.match(/([+\d,]+)\s*(?:gold|yen)/i);
            if (goldMatch) gold = goldMatch[1];
            if (!gemMatch && !goldMatch) gems = value;
          }
        }

        // 8. Drops: format "**Sorcerer King Token** · Secret"
        if (lowerName.includes('drop') || lowerName.includes('reward') || lowerName.includes('loot')) {
          const lines = value.split(/\n|,/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'None' || trimmed === '-') continue;

            let itemName = trimmed.replace(/\*\*/g, '').trim();
            let rarity: DropItem['rarity'] = 'normal';
            const quantityMatch = trimmed.replace(/\*\*/g, '').match(/(?:^|\s)([\d,]+)\s*x\b/i);
            const quantity = quantityMatch
              ? Number.parseInt(quantityMatch[1].replaceAll(',', ''), 10)
              : 1;

            const parts = trimmed.split(/[·•|\-]/).map(p => p.trim());
            if (parts.length >= 2) {
              itemName = parts[0].replace(/\*\*/g, '').trim();
              const rarityStr = parts[1].toLowerCase();
              if (rarityStr.includes('secret')) rarity = 'secret';
              else if (rarityStr.includes('mythic')) rarity = 'mythic';
              else if (rarityStr.includes('legendary')) rarity = 'legendary';
              else if (rarityStr.includes('epic')) rarity = 'epic';
              else if (rarityStr.includes('shiny')) rarity = 'shiny';
              else if (rarityStr.includes('rare')) rarity = 'rare';
            } else {
              const lowerItem = trimmed.toLowerCase();
              if (lowerItem.includes('secret')) rarity = 'secret';
              else if (lowerItem.includes('mythic')) rarity = 'mythic';
              else if (lowerItem.includes('legendary')) rarity = 'legendary';
              else if (lowerItem.includes('epic')) rarity = 'epic';
              else if (lowerItem.includes('shiny')) rarity = 'shiny';
              else if (lowerItem.includes('rare')) rarity = 'rare';
            }

            const catalogMatch = matchCatalogEntry(itemName);
            const canonicalName = catalogMatch?.entry.name || itemName;
            drops.push({
              name: canonicalName,
              originalName: canonicalName !== itemName ? itemName : undefined,
              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
              rarity,
              catalogId: catalogMatch?.entry.id,
              catalogType: catalogMatch?.entry.type,
              catalogRarity: catalogMatch?.entry.rarity || undefined,
              icon: catalogMatch?.entry.icon || undefined,
              matchConfidence: catalogMatch?.confidence,
            });
          }
        }
      }
    }
  }

  return {
    id: eventId,
    token,
    timestamp,
    eventType,
    mapName,
    result,
    wave,
    duration,
    timeElapsed,
    totalRuns,
    resultsSummary,
    nextReset,
    gems,
    gold,
    drops,
    fields: extractedFields,
    rawPayload: payload,
    profile,
  };
}
