import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
export function getClient() {
  if (!supabase) throw new Error('Falta configurar la conexión de Scan Rimonim.');
  return supabase;
}
export async function unwrap(query) { const { data, error } = await query; if (error) throw error; return data; }
