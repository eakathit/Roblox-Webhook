import catalogJson from '@/data/acx-catalog.json';

export type CatalogEntryType = 'item' | 'unit';

export interface CatalogEntry {
  id: string;
  type: CatalogEntryType;
  name: string;
  normalizedName: string;
  aliases: string[];
  rarity: string | null;
  icon: string | null;
  wikiUrl: string;
}

interface CatalogData {
  source: string;
  syncedAt: string;
  counts: { items: number; units: number; total: number };
  entries: CatalogEntry[];
}

export interface CatalogMatch {
  entry: CatalogEntry;
  confidence: number;
  matchedBy: 'name' | 'alias' | 'compact' | 'fuzzy';
}

const catalog = catalogJson as CatalogData;
const exactIndex = new Map<string, CatalogEntry[]>();
const aliasKeys = new Set<string>();

export const catalogMeta = {
  source: catalog.source,
  syncedAt: catalog.syncedAt,
  counts: catalog.counts,
};

export const catalogEntries = catalog.entries;

export function normalizeCatalogName(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\*|`/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/^\s*\d+\s*x\s*/i, '')
    .replace(/\b(secret|mythic|legendary|epic|rare|shiny|normal|crusader|exclusive)\b\s*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addToIndex(key: string, entry: CatalogEntry, isAlias = false) {
  if (!key) return;
  const values = exactIndex.get(key) || [];
  if (!values.some((value) => value.id === entry.id)) values.push(entry);
  exactIndex.set(key, values);
  if (isAlias) aliasKeys.add(`${key}::${entry.id}`);
}

for (const entry of catalog.entries) {
  addToIndex(normalizeCatalogName(entry.name), entry);
  for (const alias of entry.aliases) addToIndex(normalizeCatalogName(alias), entry, true);
}

function chooseEntry(entries: CatalogEntry[], preferredType?: CatalogEntryType) {
  if (preferredType) {
    const preferred = entries.find((entry) => entry.type === preferredType);
    if (preferred) return preferred;
  }
  return entries[0];
}

function compactName(value: string) {
  return value.replace(/\b(the|of|and)\b/g, '').replace(/\s+/g, '');
}

function bigrams(value: string) {
  const compact = value.replace(/\s+/g, '');
  const result = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    result.add(compact.slice(index, index + 2));
  }
  return result;
}

function diceSimilarity(left: string, right: string) {
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  if (!leftPairs.size || !rightPairs.size) return left === right ? 1 : 0;
  let overlap = 0;
  for (const pair of leftPairs) if (rightPairs.has(pair)) overlap += 1;
  return (2 * overlap) / (leftPairs.size + rightPairs.size);
}

export function matchCatalogEntry(rawName: string, preferredType?: CatalogEntryType): CatalogMatch | null {
  const normalized = normalizeCatalogName(rawName);
  if (!normalized) return null;

  const exactEntries = exactIndex.get(normalized);
  if (exactEntries?.length) {
    const entry = chooseEntry(exactEntries, preferredType);
    return {
      entry,
      confidence: 1,
      matchedBy: aliasKeys.has(`${normalized}::${entry.id}`) ? 'alias' : 'name',
    };
  }

  const compact = compactName(normalized);
  const compactMatches = catalog.entries.filter((entry) => {
    if (preferredType && entry.type !== preferredType) return false;
    return [entry.name, ...entry.aliases].some(
      (candidate) => compactName(normalizeCatalogName(candidate)) === compact,
    );
  });
  if (compactMatches.length === 1) {
    return { entry: compactMatches[0], confidence: 0.98, matchedBy: 'compact' };
  }

  if (normalized.length < 5) return null;
  const candidates = catalog.entries
    .filter((entry) => !preferredType || entry.type === preferredType)
    .map((entry) => ({
      entry,
      score: Math.max(
        diceSimilarity(normalized, normalizeCatalogName(entry.name)),
        ...entry.aliases.map((alias) => diceSimilarity(normalized, normalizeCatalogName(alias))),
      ),
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const runnerUp = candidates[1];
  if (!best || best.score < 0.86 || (runnerUp && best.score - runnerUp.score < 0.04)) return null;
  return { entry: best.entry, confidence: Number(best.score.toFixed(3)), matchedBy: 'fuzzy' };
}
