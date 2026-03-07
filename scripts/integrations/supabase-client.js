const SUPABASE_URL = 'https://bghelanwedtdkyfvqlhf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaGVsYW53ZWR0ZGt5ZnZxbGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNTYxNzUsImV4cCI6MjA4MDYzMjE3NX0.rpzJ2hELEr-IvEFt935DL0kP-9vFmZudf-QmKAIe4TM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose client and URL to global scope
window.SupabaseClient = supabaseClient;
window.SupabaseClient.supabaseUrl = SUPABASE_URL;
