import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_DIRECT_URL!,
  },
} satisfies Config;
