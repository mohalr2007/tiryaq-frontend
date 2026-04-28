"use client";

import { getDirectBackendOrigin } from "@/utils/directBackend";
import { supabase } from "@/utils/supabase/client";

type ApprovedDoctorIdsPayload = {
  doctorIds?: string[];
};

type ApprovedDoctorsSource =
  | "proxy"
  | "direct-backend"
  | "supabase-public"
  | "memory-cache"
  | "unavailable";

export type ApprovedDoctorIdsResult = {
  ids: Set<string> | null;
  source: ApprovedDoctorsSource;
  warning: string | null;
};

type PublicApprovedDoctorRow = {
  id: string;
  moderation_status?: string | null;
};

const APPROVED_DOCTOR_IDS_TIMEOUT_MS = 12000;
const APPROVED_DOCTOR_IDS_CACHE_TTL_MS = 60_000;

let approvedDoctorIdsPromise: Promise<ApprovedDoctorIdsResult> | null = null;
let approvedDoctorIdsMemoryCache: { ids: Set<string>; updatedAt: number } | null = null;

function cloneIds(ids: Set<string> | null) {
  return ids ? new Set(ids) : null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeNetworkError(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Le service des docteurs approuvés met trop de temps à répondre.";
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function isBlockedModerationStatus(value: string | null | undefined) {
  return value === "temporarily_blocked" || value === "permanently_blocked";
}

function getCachedApprovedDoctorIds() {
  if (!approvedDoctorIdsMemoryCache) {
    return null;
  }

  if (Date.now() - approvedDoctorIdsMemoryCache.updatedAt > APPROVED_DOCTOR_IDS_CACHE_TTL_MS) {
    approvedDoctorIdsMemoryCache = null;
    return null;
  }

  return cloneIds(approvedDoctorIdsMemoryCache.ids);
}

function setCachedApprovedDoctorIds(ids: Set<string>) {
  approvedDoctorIdsMemoryCache = {
    ids: cloneIds(ids) ?? new Set<string>(),
    updatedAt: Date.now(),
  };
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), APPROVED_DOCTOR_IDS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `API error ${response.status}`;
      throw new Error(errorMessage);
    }

    if (!payload) {
      throw new Error("Réponse vide du service des docteurs approuvés.");
    }

    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchApprovedDoctorIdsViaProxy() {
  const payload = await fetchJsonWithTimeout<ApprovedDoctorIdsPayload>(
    "/api/doctor-approvals",
    {
      method: "GET",
    },
  );

  if (!Array.isArray(payload.doctorIds)) {
    throw new Error("Réponse proxy invalide pour les docteurs approuvés.");
  }

  return new Set(payload.doctorIds);
}

async function fetchApprovedDoctorIdsViaDirectBackend() {
  const directOrigin = getDirectBackendOrigin();
  if (!directOrigin) {
    throw new Error("Origine backend directe non configurée.");
  }

  const payload = await fetchJsonWithTimeout<ApprovedDoctorIdsPayload>(
    `${directOrigin}/api/doctor-approvals`,
    {
      method: "GET",
      mode: "cors",
      credentials: "omit",
    },
  );

  if (!Array.isArray(payload.doctorIds)) {
    throw new Error("Réponse backend directe invalide pour les docteurs approuvés.");
  }

  return new Set(payload.doctorIds);
}

async function fetchApprovedDoctorIdsViaPublicSupabase() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, moderation_status")
    .eq("account_type", "doctor")
    .eq("doctor_verification_status", "approved")
    .eq("is_doctor_verified", true);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as PublicApprovedDoctorRow[]).filter(
    (row) => !isBlockedModerationStatus(row.moderation_status ?? null),
  );

  return new Set(rows.map((row) => row.id));
}

async function loadApprovedDoctorIds(): Promise<ApprovedDoctorIdsResult> {
  try {
    const ids = await fetchApprovedDoctorIdsViaProxy();
    setCachedApprovedDoctorIds(ids);
    return { ids, source: "proxy", warning: null };
  } catch (proxyError) {
    try {
      const ids = await fetchApprovedDoctorIdsViaDirectBackend();
      setCachedApprovedDoctorIds(ids);
      return { ids, source: "direct-backend", warning: null };
    } catch (directError) {
      try {
        const ids = await fetchApprovedDoctorIdsViaPublicSupabase();
        setCachedApprovedDoctorIds(ids);
        return { ids, source: "supabase-public", warning: null };
      } catch (supabaseError) {
        const cachedIds = getCachedApprovedDoctorIds();
        const warning = [
          normalizeNetworkError(proxyError, "Proxy des docteurs approuvés indisponible."),
          normalizeNetworkError(directError, "Backend direct des docteurs approuvés indisponible."),
          normalizeNetworkError(supabaseError, "Lecture publique Supabase indisponible."),
        ].join(" | ");

        if (cachedIds) {
          return {
            ids: cachedIds,
            source: "memory-cache",
            warning:
              "La liste des docteurs approuvés a été servie depuis le dernier cache local. " + warning,
          };
        }

        return {
          ids: null,
          source: "unavailable",
          warning:
            "Impossible de rafraîchir la liste des docteurs approuvés pour le moment. " + warning,
        };
      }
    }
  }
}

export async function getApprovedDoctorIdsResult() {
  if (!approvedDoctorIdsPromise) {
    approvedDoctorIdsPromise = loadApprovedDoctorIds().finally(() => {
      void wait(10_000).then(() => {
        approvedDoctorIdsPromise = null;
      });
    });
  }

  const result = await approvedDoctorIdsPromise;
  return {
    ...result,
    ids: cloneIds(result.ids),
  };
}

export async function getApprovedDoctorIdsSet() {
  const result = await getApprovedDoctorIdsResult();
  return result.ids;
}

export function filterApprovedDoctors<T extends { id: string }>(
  doctors: T[],
  approvedIds: Set<string> | null
) {
  if (!approvedIds) {
    return [];
  }

  return doctors.filter((doctor) => approvedIds.has(doctor.id));
}
