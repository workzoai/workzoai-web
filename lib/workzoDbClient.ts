"use client";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

async function getAccessToken() {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  } catch {
    return "";
  }
}

async function postDb(path: string, payload: unknown) {
  const safePayload = scrubFounderPersonalDetails(payload);
  assertNoFounderPersonalDetails(safePayload, path);

  const token = await getAccessToken();

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(safePayload),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `DB request failed: ${response.status}`);
  }

  return response.json();
}

async function getDb(path: string) {
  const token = await getAccessToken();

  const response = await fetch(path, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `DB request failed: ${response.status}`);
  }

  return response.json();
}

export async function saveWorkZoInterviewSession(payload: unknown) {
  return postDb("/api/db/interview-session", payload);
}

export async function saveWorkZoInterviewMessage(payload: unknown) {
  return postDb("/api/db/interview-message", payload);
}

export async function saveWorkZoInterviewResult(payload: unknown) {
  return postDb("/api/db/interview-result", payload);
}

export async function saveWorkZoUsageEvent(payload: unknown) {
  return postDb("/api/db/usage-event", payload);
}

export async function getLatestWorkZoInterviewResult() {
  return getDb("/api/db/interview-result");
}

export async function getLatestWorkZoActiveSession() {
  return getDb("/api/db/interview-session");
}
