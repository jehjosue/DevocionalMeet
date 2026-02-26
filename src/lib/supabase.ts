import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface VerseRow {
  id: number;
  text: string;
  reference: string;
  created_at: string;
}
