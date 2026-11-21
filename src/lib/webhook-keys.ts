import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface WebhookKeyRecord {
  publicId: string;
  displayName: string;
  keyHash: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYS_FILE = path.join(DATA_DIR, 'webhook-keys.json');

function ensureKeyFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, '[]', 'utf-8');
  }
}

function readKeys(): WebhookKeyRecord[] {
  try {
    ensureKeyFile();
    const content = fs.readFileSync(KEYS_FILE, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read webhook keys:', error);
    return [];
  }
}

function writeKeys(records: WebhookKeyRecord[]) {
  ensureKeyFile();
  const temporaryFile = `${KEYS_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(temporaryFile, KEYS_FILE);
}

function hashKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function createWebhookKey(displayName: string) {
  const writeKey = `whk_${crypto.randomBytes(24).toString('base64url')}`;
  const record: WebhookKeyRecord = {
    publicId: `direct_${crypto.randomBytes(9).toString('base64url')}`,
    displayName,
    keyHash: hashKey(writeKey),
    createdAt: new Date().toISOString(),
  };
  const records = readKeys();
  records.push(record);
  writeKeys(records);
  return { record, writeKey };
}

export function findWebhookKey(writeKey: string) {
  if (!/^whk_[A-Za-z0-9_-]{30,}$/.test(writeKey)) return null;
  const keyHash = hashKey(writeKey);
  return readKeys().find((record) => record.keyHash === keyHash) ?? null;
}

export function listWebhookProfiles() {
  return readKeys().map(({ publicId, displayName, createdAt }) => ({
    publicId,
    displayName,
    createdAt,
  }));
}
