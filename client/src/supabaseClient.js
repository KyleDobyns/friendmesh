import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zosqrzdmzyygzapvzxer.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpvc3FyemRtenl5Z3phcHZ6eGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczNjE1NjcsImV4cCI6MjA2MjkzNzU2N30.K5EH_eUPv0x8cPBe1p7mtai9NUCJQiCpvO396iA1IZg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

