"use client";

import { useEffect } from "react";

/** Signals to Playwright PDF generation that the print page has painted. */
export function PrintReadyMarker() {
  useEffect(() => {
    const markReady = () => {
      document.documentElement.dataset.printReady = "true";
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(markReady);
    });
  }, []);

  return null;
}
