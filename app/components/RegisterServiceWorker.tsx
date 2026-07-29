"use client";

import { useEffect } from "react";

// Registers the offline service worker. Production only - a service worker
// caching Turbopack's dev bundle would fight HMR and serve stale code.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline install support is best-effort - the app still works online.
    });
  }, []);

  return null;
}
