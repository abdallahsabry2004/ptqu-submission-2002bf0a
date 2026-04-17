import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Calls admin-seed once per browser session to ensure default admin exists.
export function useAdminSeed() {
  useEffect(() => {
    const flag = sessionStorage.getItem("admin_seed_done");
    if (flag) return;
    supabase.functions
      .invoke("admin-seed")
      .then(() => sessionStorage.setItem("admin_seed_done", "1"))
      .catch(() => {});
  }, []);
}
