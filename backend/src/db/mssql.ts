import sql from 'mssql';
import { config } from '../config/env';

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;

  pool = await sql.connect({
    server: config.sql.server,
    database: config.sql.database,
    user: config.sql.user,
    password: config.sql.password,
    options: {
      encrypt: Boolean(config.sql.options.encrypt),
      trustServerCertificate: true,
    },
  });

  return pool;
}

