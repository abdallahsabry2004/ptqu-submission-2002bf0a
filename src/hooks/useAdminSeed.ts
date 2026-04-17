import { useEffect } from "react";

// Admin seeding is no longer triggered from the browser.
export function useAdminSeed() {
  useEffect(() => {
    return;
  }, []);
}
