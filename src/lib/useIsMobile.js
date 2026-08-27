"use client";

import { useEffect, useState } from "react";

const QUERY = "(max-width: 768px)"; // mesmo breakpoint já usado pelo redirect mobile em Shell.js

/** true/false assim que monta no cliente; reage a resize/rotação (não só na primeira medição). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(QUERY);
    setIsMobile(mql.matches);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
