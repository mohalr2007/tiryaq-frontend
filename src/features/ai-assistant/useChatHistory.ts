"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantScope, ChatMessage } from "./types";

// ── Types ────────────────────────────────────────────────────
export type ChatSession = {
  id: string;
  title: string;
  specialty: string | null;
  body_zone: string | null;
  is_emergency: boolean;
  created_at: string;
  updated_at: string;
};

// ── Cache keys ───────────────────────────────────────────────
const LS_SESSIONS_KEY = (scope: AssistantScope) => `luna_sessions_v2_${scope}`;
const lsMsgKey = (scope: AssistantScope, id: string) => `luna_msgs_v2_${scope}_${id}`;
const lsCurrentSessionKey = (scope: AssistantScope, patientId: string | null) =>
  `luna_current_session_v2_${scope}_${patientId ?? "guest"}`;
const MESSAGE_ENVELOPE_PREFIX = "__MOFID_CHAT__:";

function getScopePrefix(scope: AssistantScope) {
  return scope === "doctor" ? "[DOCTOR_AI]" : "[PATIENT_AI]";
}

function hasAnyScopePrefix(title: string | null | undefined) {
  const value = title ?? "";
  return value.startsWith("[DOCTOR_AI]") || value.startsWith("[PATIENT_AI]");
}

function formatScopedTitle(scope: AssistantScope, title: string) {
  return `${getScopePrefix(scope)} ${title}`;
}

function stripScopedTitle(title: string) {
  return title.replace(/^\[(?:DOCTOR_AI|PATIENT_AI)\]\s*/i, "").trim();
}

function matchesScope(scope: AssistantScope, title: string | null | undefined) {
  const value = title ?? "";
  if (value.startsWith(getScopePrefix(scope))) {
    return true;
  }

  if (scope === "patient" && !hasAnyScopePrefix(value)) {
    return true;
  }

  return false;
}

// ── localStorage helpers ─────────────────────────────────────
function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full — ignore
  }
}
function lsDel(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function lsGetString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSetString(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const HISTORY_FETCH_TIMEOUT_MS = 8000;

function serializeMessage(message: ChatMessage) {
  return `${MESSAGE_ENVELOPE_PREFIX}${JSON.stringify(message)}`;
}

function deserializeMessage(content: string, createdAt?: string): ChatMessage {
  if (content.startsWith(MESSAGE_ENVELOPE_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(MESSAGE_ENVELOPE_PREFIX.length)) as ChatMessage;
      return {
        ...parsed,
        timestamp: parsed.timestamp ?? (createdAt ? new Date(createdAt).getTime() : undefined),
      };
    } catch {
      // fallback below
    }
  }

  return {
    role: "assistant",
    content,
    timestamp: createdAt ? new Date(createdAt).getTime() : undefined,
  };
}

// ── API helpers ──────────────────────────────────────────────
async function apiGet<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HISTORY_FETCH_TIMEOUT_MS);
  const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
  window.clearTimeout(timeoutId);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HISTORY_FETCH_TIMEOUT_MS);
  const res = await fetch("/api/ai-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
    cache: "no-store",
  });
  window.clearTimeout(timeoutId);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Hook ─────────────────────────────────────────────────────
export function useChatHistory(patientId: string | null, assistantScope: AssistantScope = "patient") {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let frameId: number | null = null;
    const nextSessionId =
      patientId && typeof window !== "undefined"
        ? lsGetString(lsCurrentSessionKey(assistantScope, patientId))
        : null;

    sessionIdRef.current = nextSessionId;
    frameId = window.requestAnimationFrame(() => {
      setCurrentSessionIdState(nextSessionId);
    });

    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [assistantScope, patientId]);

  // ── Load sessions list on mount ──────────────────────────
  useEffect(() => {
    if (!patientId) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setSessions([]);
        setIsLoadingHistory(false);
      });
      return () => {
        window.cancelAnimationFrame(resetFrameId);
      };
    }

    if (typeof window === "undefined") {
      return;
    }

    let frameId: number | null = null;
    let isMounted = true;

    // L2: show localStorage immediately
    const cached = lsGet<ChatSession[]>(LS_SESSIONS_KEY(assistantScope));
    const hasCachedSessions = Boolean(cached && cached.length > 0);
    if (cached) {
      frameId = window.requestAnimationFrame(() => {
        setSessions(cached);
      });
    }

    // L3: fetch from DB in background
    const loadingFrameId = hasCachedSessions
      ? null
      : window.requestAnimationFrame(() => {
          setIsLoadingHistory(true);
        });
    apiGet<{ sessions: ChatSession[] }>(`/api/ai-history?patient_id=${patientId}`)
      .then(({ sessions: fresh }) => {
        if (!isMounted) return;
        const scopedSessions = fresh
          .filter((session) => matchesScope(assistantScope, session.title))
          .map((session) => ({
            ...session,
            title: stripScopedTitle(session.title),
          }));
        setSessions(scopedSessions);
        lsSet(LS_SESSIONS_KEY(assistantScope), scopedSessions);
      })
      .catch(() => {
        if (!isMounted) return;
        if (!cached) {
          setSessions([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
      if (loadingFrameId != null) {
        window.cancelAnimationFrame(loadingFrameId);
      }
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [patientId, assistantScope]);

  // ── Create a new session ─────────────────────────────────
  const createSession = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (!patientId) return null;
      // Title = first 60 chars of first user message
      const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");
      try {
        const { session_id } = await apiPost<{ session_id: string }>({
          action: "create_session",
          patient_id: patientId,
          title: formatScopedTitle(assistantScope, title),
        });
        sessionIdRef.current = session_id;
        setCurrentSessionIdState(session_id);
        lsSetString(lsCurrentSessionKey(assistantScope, patientId), session_id);

        // Optimistic update to sessions list
        const newSession: ChatSession = {
          id: session_id,
          title,
          specialty: null,
          body_zone: null,
          is_emergency: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSessions((prev) => {
          const updated = [newSession, ...prev];
          lsSet(LS_SESSIONS_KEY(assistantScope), updated);
          return updated;
        });

        return session_id;
      } catch {
        return null;
      }
    },
    [assistantScope, patientId]
  );

  // ── Append a message to current session ──────────────────
  const appendMessage = useCallback(
    async (msg: ChatMessage) => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      // L1+L2 cache update immediately
      const cacheKey = lsMsgKey(assistantScope, sid);
      const cached = lsGet<ChatMessage[]>(cacheKey) ?? [];
      lsSet(cacheKey, [...cached, msg]);

      // L3: async save to DB (fire and forget)
      apiPost({
        action: "append_message",
        session_id: sid,
        role: msg.role,
        content: serializeMessage(msg),
      }).catch(() => {/* silent */});
    },
    [assistantScope]
  );

  const replaceMessages = useCallback(
    (messages: ChatMessage[], sessionIdOverride?: string | null) => {
      const sid = sessionIdOverride ?? sessionIdRef.current;
      if (!sid) return;
      lsSet(lsMsgKey(assistantScope, sid), messages);
    },
    [assistantScope]
  );

  // ── Update session metadata (specialty / bodyZone) ───────
  const updateSessionMeta = useCallback(
    (specialty: string, bodyZone: string | null, isEmergency: boolean) => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      const visibleTitle = `Recherche: ${specialty}` + (bodyZone ? ` (${bodyZone})` : "");
      const scopedTitle = formatScopedTitle(assistantScope, visibleTitle);

      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sid ? { ...s, title: visibleTitle, specialty, body_zone: bodyZone, is_emergency: isEmergency } : s
        );
        lsSet(LS_SESSIONS_KEY(assistantScope), updated);
        return updated;
      });

      apiPost({
        action: "update_session",
        session_id: sid,
        title: scopedTitle,
        specialty,
        body_zone: bodyZone,
        is_emergency: isEmergency,
      }).catch(() => {/* silent */});
    },
    [assistantScope]
  );

  // ── Load messages from a past session ────────────────────
  const loadSession = useCallback(
    async (sessionId: string): Promise<ChatMessage[]> => {
      // L2: check localStorage first
      const cached = lsGet<ChatMessage[]>(lsMsgKey(assistantScope, sessionId));
      if (cached && cached.length > 0) return cached;

      // L3: fetch from DB
      try {
        const { messages } = await apiGet<{ messages: Array<{ role: string; content: string; created_at: string }> }>(
          `/api/ai-history?session_id=${sessionId}`
        );
        const result: ChatMessage[] = messages.map((m) => {
          const parsed = deserializeMessage(m.content, m.created_at);
          return {
            ...parsed,
            role: m.role as "user" | "assistant",
          };
        });
        lsSet(lsMsgKey(assistantScope, sessionId), result);
        return result;
      } catch {
        return [];
      }
    },
    [assistantScope]
  );

  // ── Delete a session ────────────────────────────────────
  const deleteSession = useCallback(async (sessionId: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      lsSet(LS_SESSIONS_KEY(assistantScope), updated);
      return updated;
    });
    lsDel(lsMsgKey(assistantScope, sessionId));

    await fetch(`/api/ai-history?session_id=${sessionId}`, { method: "DELETE" }).catch(() => {});
    if (sessionIdRef.current === sessionId) {
      sessionIdRef.current = null;
      setCurrentSessionIdState(null);
      if (patientId) {
        lsDel(lsCurrentSessionKey(assistantScope, patientId));
      }
    }
  }, [assistantScope, patientId]);

  // ── Set current session (when resuming a past one) ───────
  const setCurrentSession = useCallback((id: string) => {
    sessionIdRef.current = id;
    setCurrentSessionIdState(id);
    if (patientId) {
      lsSetString(lsCurrentSessionKey(assistantScope, patientId), id);
    }
  }, [assistantScope, patientId]);

  const clearCurrentSession = useCallback(() => {
    sessionIdRef.current = null;
    setCurrentSessionIdState(null);
    if (patientId) {
      lsDel(lsCurrentSessionKey(assistantScope, patientId));
    }
  }, [assistantScope, patientId]);

  return {
    sessions,
    isLoadingHistory,
    currentSessionId,
    createSession,
    appendMessage,
    replaceMessages,
    updateSessionMeta,
    loadSession,
    deleteSession,
    setCurrentSession,
    clearCurrentSession,
  };
}
