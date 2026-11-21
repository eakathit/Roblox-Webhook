import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, 'src', 'data', 'acx-catalog.json');
const OVERRIDES_FILE = path.join(ROOT, 'data', 'acx-catalog-overrides.json');
const SOURCES = [
  { type: 'item', url: 'https://anime-crusaders-x.wiki/items/' },
  { type: 'unit', url: 'https://anime-crusaders-x.wiki/units/' },
];

function decodeHtml(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
    '#39': "'", '#x27': "'", '#8217': "'", '#x2019': "'", '#8250': '›', '#x203a': '›',
  };
  return value.replace(/&([^;]+);/g, (entity, key) => {
    if (named[key] !== undefined) return named[key];
    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return entity;
  });
}

function textFromHtml(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
    .replace(/^\s*›\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeName(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDirectory(html, source) {
  const entries = [];
  const rowPattern = /<tr\b([^>]*\bdata-feature-row="[^"]+"[^>]*)>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const attributes = rowMatch[1];
    const row = rowMatch[2];
    const labelMatch = row.match(/class="[^"]*wiki-directory-label[^"]*"[^>]*>([\s\S]*?)<\/(?:a|button)>/i);
    if (!labelMatch) continue;

    const name = textFromHtml(labelMatch[1]);
    if (!name) continue;

    const rarityMatch = row.match(/<td\b[^>]*data-label="Rarity[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    const rawRarity = rarityMatch ? textFromHtml(rarityMatch[1]) : '';
    const rarity = rawRarity && rawRarity !== '—' ? rawRarity : null;
    const rowId = attributes.match(/\bid="([^"]+)"/i)?.[1];
    const id = `${source.type}:${slugify(name)}`;

    entries.push({
      id,
      type: source.type,
      name,
      normalizedName: normalizeName(name),
      aliases: [],
      rarity,
      icon: null,
      wikiUrl: rowId ? `${source.url}#${rowId}` : source.url,
    });
  }

  return entries;
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'ACX-Farm-Tracker-Catalog-Sync/1.0' },
  });
  if (!response.ok) throw new Error(`${source.url} returned ${response.status}`);
  return extractDirectory(await response.text(), source);
}

async function main() {
  const overrides = JSON.parse(await fs.readFile(OVERRIDES_FILE, 'utf8'));
  const results = await Promise.all(SOURCES.map(fetchSource));
  const uniqueEntries = new Map();

  for (const entry of results.flat()) {
    const override = overrides[entry.id] || {};
    uniqueEntries.set(entry.id, {
      ...entry,
      aliases: Array.from(new Set([...(entry.aliases || []), ...(override.aliases || [])])),
      icon: override.icon || null,
    });
  }

  const entries = Array.from(uniqueEntries.values()).sort((a, b) =>
    a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
  );
  const catalog = {
    source: 'https://anime-crusaders-x.wiki',
    syncedAt: new Date().toISOString(),
    counts: {
      items: entries.filter((entry) => entry.type === 'item').length,
      units: entries.filter((entry) => entry.type === 'unit').length,
      total: entries.length,
    },
    entries,
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Synced ${catalog.counts.items} items and ${catalog.counts.units} units (${catalog.counts.total} total).`);
  console.log(`Saved to ${path.relative(ROOT, OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error('Catalog sync failed:', error);
  process.exitCode = 1;
});
