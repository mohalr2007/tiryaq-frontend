"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantScope, ChatMessage } from "./types";
import { fetchDirectBackend } from "@/utils/directBackend";

export type ChatSession = {
  id: string;
  title: string;
  specialty: string | null;
  body_zone: string | null;
  is_emergency: boolean;
  created_at: string;
  updated_at: string;
};

type ApiResponseBase = {
  error?: string;
  persisted?: boolean;
};

type SessionListResponse = ApiResponseBase & {
  sessions: ChatSession[];
};

type SessionMessagesResponse = ApiResponseBase & {
  messages: Array<{ role: string; content: string; created_at: string }>;
};

type CreateSessionResponse = ApiResponseBase & {
  session_id?: string;
};

type MutateHistoryResponse = ApiResponseBase & {
  ok?: boolean;
};

const LS_SESSIONS_KEY = (scope: AssistantScope) => `luna_sessions_v2_${scope}`;
const lsMsgKey = (scope: AssistantScope, id: string) => `luna_msgs_v2_${scope}_${id}`;
const lsCurrentSessionKey = (scope: AssistantScope, patientId: string | null) =>
  `luna_current_session_v2_${scope}_${patientId ?? "guest"}`;
const MESSAGE_ENVELOPE_PREFIX = "__MOFID_CHAT__:";
const HISTORY_FETCH_TIMEOUT_MS = 8000;
const LOCAL_ONLY_HISTORY_MESSAGE =
  "L'historique AI fonctionne temporairement en cache local seulement.";

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

function sessionGetString(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSetString(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

<<<<<<< Updated upstream
function sessionDel(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

=======
>>>>>>> Stashed changes
function getHistoryErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Le service d'historique AI met trop de temps à répondre.";
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      message.includes("Failed to fetch") ||
      message.includes("Load failed") ||
      message.includes("fetch failed")
    ) {
      return "Connexion à l'historique AI impossible pour le moment.";
    }

    if (message) {
      return message;
    }
  }

  return "Historique AI indisponible.";
}

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

async function parseApiJson<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let payload: ({ error?: string } & T) | null = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as { error?: string } & T;
    } catch {
      throw new Error("Réponse invalide du service d'historique AI.");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `API error ${response.status}`);
  }

  if (!payload) {
    throw new Error("Réponse vide du service d'historique AI.");
  }

  return payload as T;
}

async function apiRequestJson<T>(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HISTORY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchDirectBackend(
      path,
      {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      },
      { fallbackPath: path },
    );

    return await parseApiJson<T>(response);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function apiGet<T>(path: string) {
  return apiRequestJson<T>(path);
}

async function apiPost<T>(body: unknown) {
  return apiRequestJson<T>("/api/ai-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function apiDelete<T>(path: string) {
  return apiRequestJson<T>(path, { method: "DELETE" });
}

export function useChatHistory(patientId: string | null, assistantScope: AssistantScope = "patient") {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [isPersistenceDegraded, setIsPersistenceDegraded] = useState(false);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const markPersistenceHealthy = useCallback(() => {
    setIsPersistenceDegraded(false);
    setPersistenceMessage(null);
  }, []);

  const markPersistenceDegraded = useCallback((message = LOCAL_ONLY_HISTORY_MESSAGE) => {
    setIsPersistenceDegraded(true);
    setPersistenceMessage(message);
  }, []);

  useEffect(() => {
    let frameId: number | null = null;
    const nextSessionId =
      patientId && typeof window !== "undefined"
        ? sessionGetString(lsCurrentSessionKey(assistantScope, patientId))
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

  useEffect(() => {
    if (!patientId) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setSessions([]);
        setIsLoadingHistory(false);
        setIsPersistenceDegraded(false);
        setPersistenceMessage(null);
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

    const cached = lsGet<ChatSession[]>(LS_SESSIONS_KEY(assistantScope));
    const hasCachedSessions = Boolean(cached && cached.length > 0);

    if (cached) {
      frameId = window.requestAnimationFrame(() => {
        setSessions(cached);
      });
    }

    const loadingFrameId = hasCachedSessions
      ? null
      : window.requestAnimationFrame(() => {
          setIsLoadingHistory(true);
        });

    apiGet<SessionListResponse>(`/api/ai-history?patient_id=${patientId}`)
      .then(({ sessions: fresh, persisted }) => {
        if (!isMounted) {
          return;
        }

        if (persisted === false) {
          markPersistenceDegraded(LOCAL_ONLY_HISTORY_MESSAGE);
        } else {
          markPersistenceHealthy();
        }

        const scopedSessions = fresh
          .filter((session) => matchesScope(assistantScope, session.title))
          .map((session) => ({
            ...session,
            title: stripScopedTitle(session.title),
          }));

        setSessions(scopedSessions);
        lsSet(LS_SESSIONS_KEY(assistantScope), scopedSessions);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        markPersistenceDegraded(getHistoryErrorMessage(error));
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
  }, [assistantScope, markPersistenceDegraded, markPersistenceHealthy, patientId]);

  const createSession = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (!patientId) {
        return null;
      }

      const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");

      try {
        const payload = await apiPost<CreateSessionResponse>({
          action: "create_session",
          patient_id: patientId,
          title: formatScopedTitle(assistantScope, title),
        });

        const sessionId = payload.session_id?.trim();
        if (!sessionId) {
          throw new Error("Aucun identifiant de session AI n'a été renvoyé.");
        }

        if (payload.persisted === false) {
          markPersistenceDegraded(LOCAL_ONLY_HISTORY_MESSAGE);
        } else {
          markPersistenceHealthy();
        }

        sessionIdRef.current = sessionId;
        setCurrentSessionIdState(sessionId);
<<<<<<< Updated upstream
        sessionSetString(lsCurrentSessionKey(assistantScope, patientId), sessionId);
=======
        lsSetString(lsCurrentSessionKey(assistantScope, patientId), sessionId);
>>>>>>> Stashed changes

        const newSession: ChatSession = {
          id: sessionId,
          title,
          specialty: null,
          body_zone: null,
          is_emergency: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setSessions((prev) => {
          const updated = [newSession, ...prev.filter((session) => session.id !== sessionId)];
          lsSet(LS_SESSIONS_KEY(assistantScope), updated);
          return updated;
        });

        return sessionId;
      } catch (error) {
        markPersistenceDegraded(getHistoryErrorMessage(error));
        return null;
      }
    },
    [assistantScope, markPersistenceDegraded, markPersistenceHealthy, patientId],
  );

  const appendMessage = useCallback(
    async (msg: ChatMessage) => {
      const sid = sessionIdRef.current;
      if (!sid) {
        return;
      }

      const cacheKey = lsMsgKey(assistantScope, sid);
      const cached = lsGet<ChatMessage[]>(cacheKey) ?? [];
      lsSet(cacheKey, [...cached, msg]);

      void apiPost<MutateHistoryResponse>({
        action: "append_message",
        session_id: sid,
        role: msg.role,
        content: serializeMessage(msg),
      })
        .then((payload) => {
          if (payload.persisted === false) {
            markPersistenceDegraded(LOCAL_ONLY_HISTORY_MESSAGE);
            return;
          }

          markPersistenceHealthy();
        })
        .catch((error) => {
          markPersistenceDegraded(getHistoryErrorMessage(error));
        });
    },
    [assistantScope, markPersistenceDegraded, markPersistenceHealthy],
  );

  const replaceMessages = useCallback(
    (messages: ChatMessage[], sessionIdOverride?: string | null) => {
      const sid = sessionIdOverride ?? sessionIdRef.current;
      if (!sid) {
        return;
      }

      lsSet(lsMsgKey(assistantScope, sid), messages);
    },
    [assistantScope],
  );

  const updateSessionMeta = useCallback(
    (specialty: string, bodyZone: string | null, isEmergency: boolean) => {
      const sid = sessionIdRef.current;
      if (!sid) {
        return;
      }

      const visibleTitle = `Recherche: ${specialty}` + (bodyZone ? ` (${bodyZone})` : "");
      const scopedTitle = formatScopedTitle(assistantScope, visibleTitle);

      setSessions((prev) => {
        const updated = prev.map((session) =>
          session.id === sid
            ? { ...session, title: visibleTitle, specialty, body_zone: bodyZone, is_emergency: isEmergency }
            : session,
        );
        lsSet(LS_SESSIONS_KEY(assistantScope), updated);
        return updated;
      });

      void apiPost<MutateHistoryResponse>({
        action: "update_session",
        session_id: sid,
        title: scopedTitle,
        specialty,
        body_zone: bodyZone,
        is_emergency: isEmergency,
      })
        .then((payload) => {
          if (payload.persisted === false) {
            markPersistenceDegraded(LOCAL_ONLY_HISTORY_MESSAGE);
            return;
          }

          markPersistenceHealthy();
        })
        .catch((error) => {
          markPersistenceDegraded(getHistoryErrorMessage(error));
        });
    },
    [assistantScope, markPersistenceDegraded, markPersistenceHealthy],
  );

  const loadSession = useCallback(
    async (sessionId: string): Promise<ChatMessage[]> => {
      const cached = lsGet<ChatMessage[]>(lsMsgKey(assistantScope, sessionId));
      if (cached && cached.length > 0) {
        return cached;
      }

      try {
        const payload = await apiGet<SessionMessagesResponse>(
          `/api/ai-history?session_id=${sessionId}`,
        );

        if (payload.persisted === false) {
          markPersistenceDegraded(LOCAL_ONLY_HISTORY_MESSAGE);
        } else {
          markPersistenceHealthy();
        }

        const result: ChatMessage[] = payload.messages.map((message) => {
          const parsed = deserializeMessage(message.content, message.created_at);
          return {
            ...parsed,
            role: message.role as "user" | "assistant",
          };
        });

        lsSet(lsMsgKey(assistantScope, sessionId), result);
        return result;
      } catch (error) {
        markPersistenceDegraded(getHistoryErrorMessage(error));
        return [];
      }
    },
    [assistantScope, markPersistenceDegraded, markPersistenceHealthy],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setSessions((prev) => {
        const updated = prev.filter((session) => session.id !== sessionId);
        lsSet(LS_SESSIONS_KEY(assistantScope), updated);
        return updated;
      });
      lsDel(lsMsgKey(assistantScope, sessionId));

      try {
        const payload = await apiDelete<MutateHistoryResponse>(
          `/api/ai-history?session_id=${sessionId}`,
        );

        if (payload.persisted === false) {
          markPersistenceDegraded(LOCAL_ONLY_HISTORY_MESSAGE);
        } else {
          markPersistenceHealthy();
        }
      } catch (error) {
        markPersistenceDegraded(getHistoryErrorMessage(error));
      }

      if (sessionIdRef.current === sessionId) {
        sessionIdRef.current = null;
        setCurrentSessionIdState(null);
        if (patientId) {
<<<<<<< Updated upstream
          sessionDel(lsCurrentSessionKey(assistantScope, patientId));
=======
          lsDel(lsCurrentSessionKey(assistantScope, patientId));
>>>>>>> Stashed changes
        }
      }
    },
    [assistantScope, markPersistenceDegraded, markPersistenceHealthy, patientId],
  );

  const setCurrentSession = useCallback(
    (id: string) => {
      sessionIdRef.current = id;
      setCurrentSessionIdState(id);
      if (patientId) {
<<<<<<< Updated upstream
        sessionSetString(lsCurrentSessionKey(assistantScope, patientId), id);
=======
        lsSetString(lsCurrentSessionKey(assistantScope, patientId), id);
>>>>>>> Stashed changes
      }
    },
    [assistantScope, patientId],
  );

  const clearCurrentSession = useCallback(() => {
    sessionIdRef.current = null;
    setCurrentSessionIdState(null);
    if (patientId) {
      sessionDel(lsCurrentSessionKey(assistantScope, patientId));
    }
  }, [assistantScope, patientId]);

  return {
    sessions,
    isLoadingHistory,
    currentSessionId,
    isPersistenceDegraded,
    persistenceMessage,
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
