"use client";

import { useEffect } from "react";

/**
 * This app does not use a service worker. Stale registrations (e.g. from an
 * old deploy or browser extension) can intercept navigations and fail with
 * "Failed to fetch" in DevTools.
 */
export function UnregisterServiceWorkers() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  }, []);

  return null;
}
