"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const controller = new AbortController();

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch((err) => {
        console.error("[PWA] service worker registration failed", err);
      });

    return () => controller.abort();
  }, []);

  return null;
}
