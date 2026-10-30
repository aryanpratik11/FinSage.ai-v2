"use client";

import { useEffect } from "react";
import { startPwa } from "@/lib/pwa";

/** Registers the service worker and install listeners on every page. */
export function PwaSetup() {
  useEffect(() => startPwa(), []);
  return null;
}
