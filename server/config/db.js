import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

/**
 * DEVELOPMENT PERSISTENCE LAYER
 * -----------------------------
 * The project spec calls for MongoDB + Mongoose. This environment doesn't
 * have a MongoDB server available, so per the spec's own fallback
 * instruction, this uses lowdb (a JSON file store) as a stand-in.
 *
 * Every collection below mirrors what the Mongoose schemas will look like
 * (see docs/DATABASE.md, added in a later phase). Controllers/services
 * only ever talk to `getDB()` and treat each key as a collection — so
 * swapping this file for a real Mongoose connection later does not
 * require touching controller code, only the model layer.
 */

const defaultData = {
  users: [],
  patients: [],
  departments: [],
  doctors: [],
  rooms: [],
  appointments: [],
  queueEntries: [],
  consultations: [],
  prescriptions: [],
  notifications: [],
  auditLogs: [],
  hospitalSettings: {
    averageConsultationMinutes: 5,
    queueTokenPrefixes: { normal: 'A', appointment: 'B', emergency: 'E' },
  },
};

let dbInstance = null;

export async function connectDB(filePathOverride) {
  if (dbInstance) return dbInstance;

  const targetFile = filePathOverride || DB_FILE;
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  const adapter = new JSONFile(targetFile);
  const db = new Low(adapter, defaultData);

  await db.read();
  db.data ||= defaultData;

  // Ensure any new collections added over time exist on older db.json files
  for (const key of Object.keys(defaultData)) {
    if (db.data[key] === undefined) {
      db.data[key] = defaultData[key];
    }
  }

  await db.write();

  dbInstance = db;
  console.log(`[db] Connected to local JSON store at ${targetFile}`);
  return dbInstance;
}

// Test-only: allow the test suite to reset the singleton between files.
export function _resetDBForTests() {
  dbInstance = null;
}

export function getDB() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call connectDB() before getDB().');
  }
  return dbInstance;
}
