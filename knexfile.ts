import { Knex } from 'knex';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'mydatabase',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined, // Optional SSL in development
      timezone: 'UTC', // Ensure consistent UTC behavior
    },
    pool: {
      min: 0, // Scale down pool to zero when idle
      max: 5, // Small pool size to avoid overloading DB
      idleTimeoutMillis: 3000, // Quickly release idle connections
      createTimeoutMillis: 10000, // Timeout for creating a new connection
      acquireTimeoutMillis: 10000, // Timeout for acquiring a connection
      destroyTimeoutMillis: 1000, // Gracefully destroy connections
      reapIntervalMillis: 1000, // Cleanup interval for stale connections
    },
    debug: false, // Enable debug logs in dev
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.RDS_PROXY_ENDPOINT || process.env.DB_HOST, // Use RDS Proxy for better connection pooling
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined, // Enforce SSL in production
      timezone: 'UTC', // Ensure UTC behavior
    },
    pool: {
      min: 0, // Scale down pool to zero when idle
      max: 5, // Optimize for Lambda's short lifecycle
      idleTimeoutMillis: 3000,
      createTimeoutMillis: 10000,
      acquireTimeoutMillis: 10000,
      destroyTimeoutMillis: 1000,
      reapIntervalMillis: 1000,
    },
    debug: false, // Disable debug logs in production
  },
};

export default config;