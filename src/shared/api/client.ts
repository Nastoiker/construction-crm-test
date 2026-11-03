import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isConfigured = Boolean(
  url && key && key !== 'your-local-or-cloud-publishable-key',
);
export const supabase = createClient<Database>(
  url || 'http://127.0.0.1:54321',
  key || 'configuration-required',
  { db: { retry: false } },
);

type Functions = Database['public']['Functions'];
export async function rpc<Name extends keyof Functions>(
  name: Name,
  args: Functions[Name]['Args'],
): Promise<void> {
  // TanStack Query owns retry policy. Retrying writes could duplicate creation.
  const { error } = await supabase.rpc(name, args);
  if (error) throw error;
}
