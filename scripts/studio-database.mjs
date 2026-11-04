import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Counts and millisecond timestamps fit exactly in the JS safe integer range.
const types = {
  getTypeParser: (oid, format) =>
    oid === 20 ? Number : pg.types.getTypeParser(oid, format),
};
export const analyticsSchema = `
 CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY, visitor TEXT NOT NULL, at BIGINT NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, browser TEXT NOT NULL, ip TEXT, location TEXT);
 CREATE INDEX IF NOT EXISTS views_at ON page_views(at);
 CREATE INDEX IF NOT EXISTS views_visitor ON page_views(visitor);
 CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, started BIGINT NOT NULL, seen BIGINT NOT NULL, active REAL NOT NULL DEFAULT 0, room TEXT NOT NULL, mode TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT -1);
 CREATE INDEX IF NOT EXISTS visits_started ON visits(started);
 CREATE TABLE IF NOT EXISTS visit_events (id INTEGER PRIMARY KEY, session TEXT NOT NULL, at BIGINT NOT NULL, kind TEXT NOT NULL, room TEXT NOT NULL, target TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS events_session ON visit_events(session,at);
 CREATE INDEX IF NOT EXISTS events_at ON visit_events(at);`;

export async function createStudioDatabase(
  dataDir,
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString) return null;
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    min: 0,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
    types,
  });
  pool.on('error', () =>
    console.error(
      'PostgreSQL idle connection unavailable; requests will reconnect.',
    ),
  );
  const transaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };
  try {
    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(724103891)');
      await client.query(
        analyticsSchema
          .replaceAll('id INTEGER PRIMARY KEY', 'id BIGSERIAL PRIMARY KEY')
          .replaceAll('active REAL', 'active DOUBLE PRECISION'),
      );
      await client.query(`CREATE TABLE IF NOT EXISTS studio_documents (key TEXT PRIMARY KEY, value JSONB NOT NULL, revision BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS studio_migrations (key TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT now(), summary JSONB NOT NULL)`);
      if (
        (
          await client.query(
            "SELECT 1 FROM studio_migrations WHERE key='legacy-v1'",
          )
        ).rowCount
      )
        return;
      const summary = {};
      const file = resolve(dataDir, 'visitor-analytics.sqlite');
      if (existsSync(file)) {
        const legacy = new DatabaseSync(file, { readOnly: true });
        try {
          legacy.exec('BEGIN');
          for (const table of ['page_views', 'visits', 'visit_events']) {
            if (
              !legacy
                .prepare(
                  "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                )
                .get(table)
            )
              continue;
            if (
              (await client.query(`SELECT COUNT(*) n FROM ${table}`)).rows[0]
                .n !== 0
            )
              throw Error('Migration destination is not empty');
            const rows = legacy.prepare(`SELECT * FROM ${table}`).all();
            if (rows.length) {
              const columns = Object.keys(rows[0]);
              for (let i = 0; i < rows.length; i += 500) {
                const batch = rows.slice(i, i + 500),
                  values = [];
                const slots = batch.map(
                  (row) =>
                    '(' +
                    columns
                      .map((k) => {
                        values.push(row[k]);
                        return '$' + values.length;
                      })
                      .join(',') +
                    ')',
                );
                await client.query(
                  `INSERT INTO ${table} (${columns.join(',')}) VALUES ${slots.join(',')}`,
                  values,
                );
              }
            }
            const count = (
              await client.query(`SELECT COUNT(*) n FROM ${table}`)
            ).rows[0].n;
            if (count !== rows.length)
              throw Error('Migration row count mismatch');
            summary[table] = count;
            if (table !== 'visits')
              await client.query(
                `SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE(MAX(id),1), COUNT(*)>0) FROM ${table}`,
              );
          }
          legacy.exec('COMMIT');
        } finally {
          legacy.close();
        }
      }
      for (const key of [
        'house-settings.json',
        'room-notes.json',
        'model-library/catalog.json',
      ]) {
        try {
          const value = JSON.parse(
            await readFile(resolve(dataDir, key), 'utf8'),
          );
          const written = await client.query(
            'INSERT INTO studio_documents(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING key',
            [key, JSON.stringify(value)],
          );
          if (!written.rowCount)
            throw Error('Migration document already exists');
          const saved = (
            await client.query(
              'SELECT value FROM studio_documents WHERE key=$1',
              [key],
            )
          ).rows[0].value;
          // JSONB normalizes object key order; compare structure, not serialization order.
          const { isDeepStrictEqual } = await import('node:util');
          if (!isDeepStrictEqual(saved, value))
            throw Error('Migration document mismatch');
          summary[key] = true;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      await client.query(
        "INSERT INTO studio_migrations(key,summary) VALUES('legacy-v1',$1)",
        [JSON.stringify(summary)],
      );
      console.info(
        'PostgreSQL legacy migration verified:',
        JSON.stringify(summary),
      );
    });
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    kind: 'postgres',
    query: async (sql, params = []) => (await pool.query(sql, params)).rows,
    transaction,
    async document(key) {
      let revision = -1;
      return {
        async read() {
          const row = (
            await pool.query(
              'SELECT value,revision FROM studio_documents WHERE key=$1',
              [key],
            )
          ).rows[0];
          revision = row?.revision ?? -1;
          if (!row)
            throw Object.assign(Error('Document not found'), {
              code: 'ENOENT',
            });
          return row.value;
        },
        async write(value) {
          const result =
            revision === -1
              ? await pool.query(
                  'INSERT INTO studio_documents(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING revision',
                  [key, JSON.stringify(value)],
                )
              : await pool.query(
                  'UPDATE studio_documents SET value=$2,revision=revision+1,updated_at=now() WHERE key=$1 AND revision=$3 RETURNING revision',
                  [key, JSON.stringify(value), revision],
                );
          if (!result.rowCount)
            throw Object.assign(Error('内容已被另一处更新，请刷新后重试。'), {
              status: 409,
            });
          revision = result.rows[0].revision;
        },
      };
    },
    close: () => pool.end(),
  };
}
