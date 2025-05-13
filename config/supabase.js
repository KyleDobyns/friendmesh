// server/config/supabase.js
const { createClient } = require('@supabase/supabase-js');

// Placeholder for Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };