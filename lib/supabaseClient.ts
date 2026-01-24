import { processLock } from '@supabase/auth-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Nie je nastavená supabase URL alebo Anon key.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use an in-memory lock to avoid navigator.locks AbortError issues.
    lock: processLock,
  },
});
