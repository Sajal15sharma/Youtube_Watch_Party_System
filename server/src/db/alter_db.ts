import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

async function alterDb() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/youtube_watch_party';
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query('ALTER TABLE rooms ALTER COLUMN current_video_id DROP NOT NULL;');
    await client.query('ALTER TABLE rooms ALTER COLUMN current_video_id DROP DEFAULT;');
    console.log('✅ Successfully altered PostgreSQL rooms.current_video_id column to nullable!');
  } catch (err: any) {
    console.error('DB Alter Note:', err.message);
  } finally {
    await client.end();
  }
}

alterDb();
