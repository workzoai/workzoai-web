"use client";

import { useEffect } from "react";
import { clearDirtyLegacyWorkZoStorage } from "@/lib/workzoPrivacyCleanup";

export default function LegacyStoragePrivacyCleanup() {
  useEffect(() => {
    clearDirtyLegacyWorkZoStorage();
  }, []);

  return null;
}
