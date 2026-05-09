import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xtyhkgefcncbpiqyqivf.supabase.co";
const SUPABASE_KEY = "sb_publishable_JkH3PoXWgL2qdpbwNsCSyg_pV5Wh26Z";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
