"use client";

type AdminApiErrorPayload = {
  error?: string;
};

type AdminApiFetchOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

const DEFAULT_ADMIN_API_TIMEOUT_MS = 15_000;
const DEFAULT_ADMIN_API_RETRY_DELAY_MS = 1_000;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeAdminApiMessage(message: string) {
  if (message.includes("Le frontend pointe vers lui-même")) {
    return "Proxy admin mal configuré sur Vercel. BACKEND_ORIGIN et NEXT_PUBLIC_BACKEND_ORIGIN doivent pointer vers https://tiryaq-backeend.onrender.com.";
  }

  if (message.includes("Le backend distant est injoignable")) {
    return "Le backend admin Render est injoignable ou en cours de réveil. Réessayez dans quelques secondes.";
  }

  if (
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("Load failed")
  ) {
    return "Connexion au portail admin impossible. Vérifiez le proxy Vercel et l'état du backend Render.";
  }

  if (message.includes("Réponse API invalide")) {
    return "Réponse admin invalide. Vérifiez le proxy frontend et le backend Render.";
  }

  return message;
}

function getAdminApiErrorDetails(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      retryable: true,
      message:
        "Le portail admin met trop de temps à répondre. Le backend Render est peut-être encore en réveil.",
    };
  }

  if (error instanceof Error) {
    const normalizedMessage = normalizeAdminApiMessage(error.message.trim());
    const retryable =
      error.message.includes("Failed to fetch") ||
      error.message.includes("fetch failed") ||
      error.message.includes("Load failed") ||
      error.message.includes("Le backend distant est injoignable") ||
      error.message.includes("API error 502") ||
      error.message.includes("API error 503") ||
      error.message.includes("API error 504");

    return {
      retryable,
      message: normalizedMessage || "Erreur admin inconnue.",
    };
  }

  return {
    retryable: false,
    message: "Erreur admin inconnue.",
  };
}

async function parseAdminApiJson<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let payload: (AdminApiErrorPayload & T) | null = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as AdminApiErrorPayload & T;
    } catch {
      throw new Error("Réponse API invalide.");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `API error ${response.status}`);
  }

  if (!payload) {
    throw new Error("Réponse API vide ou invalide.");
  }

  return payload as T;
}

export async function fetchAdminApiJson<T>(
  path: string,
  init: RequestInit = {},
  options: AdminApiFetchOptions = {},
): Promise<T> {
  const retries = options.retries ?? 0;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_ADMIN_API_RETRY_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ADMIN_API_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(path, {
        ...init,
        cache: init.cache ?? "no-store",
        signal: controller.signal,
      });

      return await parseAdminApiJson<T>(response);
    } catch (error) {
      const details = getAdminApiErrorDetails(error);
      const shouldRetry = details.retryable && attempt < retries;

      if (shouldRetry) {
        await wait(retryDelayMs);
        continue;
      }

      throw new Error(details.message);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error("Erreur admin inconnue.");
}
