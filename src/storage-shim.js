import { supabase } from "./supabase.js";

window.storage = {
  async get(key) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("kv_store")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", key)
        .limit(1);
      if (error || !data || data.length === 0) return null;
      return { key, value: data[0].value };
    } catch { return null; }
  },

  async set(key, value) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      await supabase.from("kv_store").upsert({
        user_id: user.id, key, value,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,key" });
      return { key, value };
    } catch { return null; }
  },

  async delete(key) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      await supabase.from("kv_store")
        .delete().eq("user_id", user.id).eq("key", key);
      return { key, deleted: true };
    } catch { return null; }
  },
};
