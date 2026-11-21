import fs from 'fs';
import path from 'path';
import {
  SphereDatabase,
  createInitialSeed,
  migrateSeedData,
  sanitizeUser,
  sanitizeUsersForViewer,
} from './seedData';

export type { SphereDatabase };
export { sanitizeUser, sanitizeUsersForViewer };

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'sphere-db.json');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let cachedDb: SphereDatabase | null = null;

export function getDb(): SphereDatabase {
  if (cachedDb) return cachedDb;
  ensureDirs();
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as SphereDatabase;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.posts)) {
        const migrated = migrateSeedData(parsed);
        cachedDb = parsed;
        if (migrated) saveDb(cachedDb);
        return cachedDb;
      }
    } catch {
      // Fall back to fresh seed if corrupted
    }
  }
  cachedDb = createInitialSeed();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: SphereDatabase): void {
  ensureDirs();
  cachedDb = db;
  fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf-8');
}
