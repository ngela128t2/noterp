import { supabase } from "./supabase.js";

window.storage = {
  async get(key) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("kv_store")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .single();
    if (!data) return null;
    return { key, value: data.value };
  },

  async set(key, value) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    await supabase.from("kv_store").upsert({
      user_id: user.id, key, value,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,key" });
    return { key, value };
  },

  async delete(key) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    await supabase.from("kv_store")
      .delete().eq("user_id", user.id).eq("key", key);
    return { key, deleted: true };
  },
};
