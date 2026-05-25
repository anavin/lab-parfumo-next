"use client";

/**
 * Triggers window.print() once on mount — so opening /po/[id]/print
 * pops the browser print dialog immediately
 */
import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    // Wait one frame to ensure layout settled
    const t = setTimeout(() => {
      if (typeof window !== "undefined") window.print();
    }, 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
