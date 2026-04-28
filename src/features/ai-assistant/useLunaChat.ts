"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStableAuthUser, supabase } from "@/utils/supabase/client";
import { syncExpiredDoctorVacations } from "@/utils/doctorAvailability";
import { useI18n } from "@/lib/i18n";
import { detectMessageLanguage, type AssistantLanguage } from "./language";
import { fetchRecommendedDoctors, searchDoctorsByMessage } from "./recommendations";
import { extractExplicitSpecialties } from "./specialty";
import { useChatHistory } from "./useChatHistory";
import type {
  AssistantScope,
  ChatAttachment,
  ChatMessage,
  LunaAnalysis,
  RecommendedDoctor,
  UserLocation,
} from "./types";
import type { AppLanguage } from "@/lib/i18n-config";

type UseLunaChatReturn = {
  messages: ChatMessage[];
  isThinking: boolean;
  analysis: LunaAnalysis | null;
  suggestedDoctors: RecommendedDoctor[];
  location: UserLocation | null;
  locationStatus: string;
  locationBlocked: boolean;
  isLoadingDoctors: boolean;
  patientId: string | null;
  userRole: AssistantScope | null;
  userName: string | null;
  userGender: string | null;
  userAvatarUrl: string | null;
  isAnalyzingAttachment: boolean;
  history: ReturnType<typeof useChatHistory>;
  sendMessage: (text: string, attachments?: Array<{ file: File; previewUrl?: string | null; kind: "image" | "pdf" }>) => Promise<void>;
  requestLocation: () => void;
  resetChat: () => void;
  loadPastSession: (sessionId: string) => Promise<void>;
};

type AssistantBootstrapContext = {
  id: string;
  name: string | null;
  gender: string | null;
  avatarUrl: string | null;
  role: AssistantScope;
} | null;

let assistantBootstrapCache: AssistantBootstrapContext | undefined;
let assistantBootstrapPromise: Promise<AssistantBootstrapContext> | null = null;

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDoctorsSummary(doctors: RecommendedDoctor[]): string {
  if (doctors.length === 0) {
    return "";
  }

  return doctors
    .map((doctor) => {
      const distance = doctor.distanceKm != null ? `${doctor.distanceKm.toFixed(1)} km` : "distance unknown";
      const rating = doctor.rating > 0 ? `⭐ ${doctor.rating.toFixed(1)}/5` : "new";
      return `- ${doctor.full_name ?? "Dr."} | ${doctor.specialty ?? "General"} | ${distance} | ${rating}`;
    })
    .join("\n");
}

function deduplicateDoctors(doctors: RecommendedDoctor[]): RecommendedDoctor[] {
  const seen = new Set<string>();
  return doctors.filter((doctor) => {
    const key =
      doctor.id?.trim() ||
      `${(doctor.full_name ?? "").toLowerCase().trim()}::${(doctor.address ?? "").toLowerCase().trim()}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function createWelcomeMessage(
  userName?: string,
  userRole: AssistantScope = "patient",
  language: AppLanguage = "fr"
): ChatMessage {
  const inArabic = language === "ar";
  const inEnglish = language === "en";

  if (userRole === "doctor") {
    if (inArabic) {
      return {
        role: "assistant",
        content: `أهلاً بك. أنا MOFID، المساعد الطبي الذكي لمنصة TERIAQ. يمكنني مساعدتك في تحليل الحالات السريرية وتلخيص الصور أو الملفات الطبية وصياغة ملاحظاتك المهنية. سأجيب دائماً بلغة رسالتك.`,
      };
    }

    if (inEnglish) {
      return {
        role: "assistant",
        content: `Hello. I am MOFID, the smart medical assistant of the TERIAQ platform. I can help you analyze clinical cases, summarize medical images/files, and prepare professional notes. I always reply in your message language.`,
      };
    }

    return {
      role: "assistant",
      content: `Bonjour. Je suis MOFID, l'assistant médical intelligent de la plateforme TERIAQ. Je peux vous aider à analyser un cas, résumer une image ou un fichier clinique, et préparer vos réponses ou notes. J'adapte toujours ma réponse à la langue de votre message.`,
    };
  }

  if (inArabic) {
    return {
      role: "assistant",
      content: `أهلاً بك. أنا MOFID، مساعدك الطبي الذكي في منصة TERIAQ. صِف لي أعراضك، اطلب تخصصاً طبياً، أو أرسل صورة طبية لتحليلها. سأرد دائماً بلغة رسالتك ويمكنني اقتراح الأطباء المناسبين حسب التخصص والموقع.`,
    };
  }

  if (inEnglish) {
    return {
      role: "assistant",
      content: `Hello. I am MOFID, your medical assistant on TERIAQ. Describe your symptoms, ask for a specialty, or upload a medical photo. I reply in your message language and can suggest suitable doctors based on specialty and location.`,
    };
  }

  return {
    role: "assistant",
    content: `Bonjour. Je suis MOFID, votre assistant médical sur TERIAQ. Décrivez vos symptômes, demandez un spécialiste ou téléversez une photo médicale. Je répondrai dans la langue de votre message et je peux vous proposer des médecins adaptés selon la spécialité et la localisation.`,
  };
}

function getLocationStatusLabel(
  language: AppLanguage,
  role: AssistantScope,
  hasLocation = false
) {
  if (role === "doctor") {
    if (language === "ar") return "مساعد الطبيب نشط";
    if (language === "en") return "Doctor assistant active";
    return "Assistant docteur actif";
  }

  if (hasLocation) {
    if (language === "ar") return "تم تفعيل الموقع (≤50 كم)";
    if (language === "en") return "Location enabled (≤50 km)";
    return "Localisation activée (≤50 km)";
  }

  if (language === "ar") return "الموقع غير مفعّل";
  if (language === "en") return "Location inactive";
  return "Localisation inactive";
}

function hasBookingIntent(text: string) {
  return /\b(r[eé]server|rendez[- ]?vous|rdv|book|appointment|prendre un rdv|reserve|choisir|sélectionner|select|consultation|voir le docteur|voir dr|schedule|slot)\b|(?:حجز|موعد|احجز|أحجز|دكتور|طبيب)/i.test(text);
}

function isSimpleGreeting(text: string) {
  const normalized = normalizeSearchText(text);
  if (!normalized) {
    return false;
  }

  return /^(bonjour|salut|coucou|bonsoir|hi|hello|hey|salam|slm|marhaba|مرحبا|اهلا|أهلا|السلام عليكم)$/.test(normalized);
}

function findDoctorMention(text: string, doctors: RecommendedDoctor[]) {
  const normalizedMessage = normalizeSearchText(text);

  return (
    doctors.find((doctor) => {
      const normalizedName = normalizeSearchText(doctor.full_name ?? "");
      if (!normalizedName) {
        return false;
      }

      const surname = normalizedName.split(" ").slice(-1)[0];
      return normalizedMessage.includes(normalizedName) || normalizedMessage.includes(surname);
    }) ?? null
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

function buildSessionTitle(text: string, attachments: ChatAttachment[]) {
  const trimmed = text.trim();
  if (trimmed) {
    return trimmed;
  }

  if (attachments.length === 0) {
    return "Nouvelle conversation";
  }

  if (attachments.length === 1) {
    return attachments[0].kind === "image" ? `Image: ${attachments[0].name}` : `PDF: ${attachments[0].name}`;
  }

  return `${attachments.length} pièces jointes`;
}

async function parseApiJsonOrThrow<T>(response: Response, fallbackError: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    const rawText = await response.text();
    if (rawText.trim().startsWith("<!DOCTYPE") || rawText.trim().startsWith("<html")) {
      throw new Error(fallbackError);
    }

    throw new Error(rawText || fallbackError);
  }

  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackError);
  }

  return payload;
}

function translateManualBookingReply(
  language: AssistantLanguage,
  key:
    | "doctor_not_found"
    | "manual_booking_only"
    | "manual_booking_only_identified",
  context?: { doctorName?: string }
) {
  const doctorName = context?.doctorName ?? "ce médecin";

  if (language === "ar") {
    switch (key) {
      case "doctor_not_found":
        return "لم أتعرف على الطبيب المطلوب. افتح بطاقة الطبيب المقترح ثم احجز يدوياً من هناك.";
      case "manual_booking_only_identified":
        return `أستطيع اقتراح الدكتور ${doctorName} ومساعدتك في العثور عليه، لكن الحجز من داخل المحادثة تم تعطيله. افتح بطاقة الطبيب ثم استخدم الحجز اليدوي.`;
      case "manual_booking_only":
        return "أنا أستطيع اقتراح الأطباء القريبين حسب الموقع والتخصص، لكن الحجز من داخل المحادثة تم تعطيله. استخدم الحجز اليدوي من بطاقة الطبيب.";
    }
  }

  if (language === "en") {
    switch (key) {
      case "doctor_not_found":
        return "I could not identify the doctor you want. Open the suggested doctor card and book manually from there.";
      case "manual_booking_only_identified":
        return `I can suggest Dr. ${doctorName} and help you find them, but booking from inside the chat is disabled now. Open the doctor's card and use the manual booking flow.`;
      case "manual_booking_only":
        return "I can suggest nearby doctors based on your location and specialty, but booking from inside the chat is disabled. Please use the manual booking flow from the doctor card.";
    }
  }

  switch (key) {
    case "doctor_not_found":
      return "Je n'ai pas reconnu le médecin demandé. Ouvrez la carte du praticien proposé puis utilisez la réservation manuelle depuis là-bas.";
    case "manual_booking_only_identified":
      return `Je peux vous proposer le Dr ${doctorName} et vous aider à le retrouver, mais la réservation depuis le chat est désactivée. Ouvrez sa carte puis utilisez la réservation manuelle.`;
    case "manual_booking_only":
      return "Je peux proposer des médecins proches selon votre localisation et la spécialité demandée, mais la réservation depuis le chat est désactivée. Utilisez la réservation manuelle depuis la fiche du praticien.";
  }
}

async function getAssistantBootstrapContext(): Promise<AssistantBootstrapContext> {
  if (assistantBootstrapCache !== undefined) {
    return assistantBootstrapCache;
  }

  if (!assistantBootstrapPromise) {
    assistantBootstrapPromise = (async () => {
      try {
        const { user, error: authError } = await getStableAuthUser();
        if (authError || !user) {
          assistantBootstrapCache = null;
          return assistantBootstrapCache;
        }
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, gender, account_type, avatar_url")
          .eq("id", user.id)
          .single();

        assistantBootstrapCache = {
          id: user.id,
          name: profileData?.full_name ?? null,
          gender: profileData?.gender ?? null,
          avatarUrl: profileData?.avatar_url ?? null,
          role: profileData?.account_type === "doctor" ? "doctor" : "patient",
        };

        return assistantBootstrapCache;
      } catch {
        assistantBootstrapCache = null;
        return assistantBootstrapCache;
      } finally {
        assistantBootstrapPromise = null;
      }
    })();
  }

  return assistantBootstrapPromise;
}

export function useLunaChat(): UseLunaChatReturn {
  const { language } = useI18n();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AssistantScope | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(undefined, "patient", language)]);
  const [isThinking, setIsThinking] = useState(false);
  const [analysis, setAnalysis] = useState<LunaAnalysis | null>(null);
  const [suggestedDoctors, setSuggestedDoctors] = useState<RecommendedDoctor[]>([]);
  const [doctorContext, setDoctorContext] = useState<RecommendedDoctor[]>([]);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState(() => getLocationStatusLabel(language, "patient", false));
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isAnalyzingAttachment, setIsAnalyzingAttachment] = useState(false);
  const locationRef = useRef<UserLocation | null>(null);
  const sessionCreatedRef = useRef(false);
  const restoredSessionIdRef = useRef<string | null>(null);

  const assistantScope: AssistantScope = userRole === "doctor" ? "doctor" : "patient";
  const history = useChatHistory(patientId, assistantScope);

  useEffect(() => {
    let isMounted = true;

    const bootstrapUser = async () => {
      const context = await getAssistantBootstrapContext();
      if (!context || !isMounted) {
        return;
      }

      const resolvedRole = context.role;
      const resolvedName = context.name;

      setPatientId(context.id);
      setUserRole(resolvedRole);
      setUserName(resolvedName);
      setUserGender(context.gender ?? null);
      setUserAvatarUrl(context.avatarUrl ?? null);
      setLocationStatus(
        getLocationStatusLabel(language, resolvedRole, Boolean(locationRef.current))
      );
      setMessages((previous) => {
        if (previous.length === 1 && previous[0].role === "assistant") {
          return [createWelcomeMessage(resolvedName ?? undefined, resolvedRole, language)];
        }
        return previous;
      });
    };

    void bootstrapUser();

    return () => {
      isMounted = false;
    };
  }, [language]);

  useEffect(() => {
    setMessages((previous) => {
      if (previous.length === 1 && previous[0].role === "assistant") {
        return [createWelcomeMessage(userName ?? undefined, assistantScope, language)];
      }
      return previous;
    });
    setLocationStatus(getLocationStatusLabel(language, assistantScope, Boolean(locationRef.current)));
  }, [assistantScope, language, userName]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        assistantBootstrapCache = null;
        sessionCreatedRef.current = false;
        setPatientId(null);
        setUserName(null);
        setUserGender(null);
        setUserRole(null);
        setUserAvatarUrl(null);
        setMessages([createWelcomeMessage(undefined, "patient", language)]);
        return;
      }

      if (assistantBootstrapCache?.id !== session.user.id) {
        assistantBootstrapCache = undefined;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [language]);

  const appendAssistantMessage = useCallback(
    async (content: string, options?: { suggestedDoctors?: RecommendedDoctor[] }) => {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content,
        timestamp: Date.now(),
      };
      if (options?.suggestedDoctors && options.suggestedDoctors.length > 0) {
        assistantMessage.suggestedDoctors = options.suggestedDoctors;
      }
      setMessages((previous) => [...previous, assistantMessage]);
      if (options?.suggestedDoctors && options.suggestedDoctors.length > 0) {
        setSuggestedDoctors(options.suggestedDoctors);
        setDoctorContext(options.suggestedDoctors);
      } else {
        setSuggestedDoctors([]);
      }
      await history.appendMessage(assistantMessage);
      return assistantMessage;
    },
    [history]
  );

  const attachDoctorsToLatestAssistantMessage = useCallback(
    (docs: RecommendedDoctor[]) => {
      setSuggestedDoctors(docs);
      setDoctorContext(docs);
      let nextMessages: ChatMessage[] | null = null;

      setMessages((previous) => {
        const lastAssistantIndex = [...previous]
          .map((message, index) => ({ message, index }))
          .reverse()
          .find((entry) => entry.message.role === "assistant")?.index;

        if (lastAssistantIndex == null) {
          return previous;
        }

        const next = [...previous];
        next[lastAssistantIndex] = {
          ...next[lastAssistantIndex],
          suggestedDoctors: docs,
        };
        nextMessages = next;
        return next;
      });

      if (nextMessages) {
        history.replaceMessages(nextMessages);
      }
    },
    [history]
  );

  const resolveBrowserLocation = useCallback(async (forcePrompt = false): Promise<UserLocation | null> => {
    if (locationRef.current) {
      return locationRef.current;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("Géolocalisation non prise en charge");
      setLocationBlocked(true);
      return null;
    }

    try {
      const permissionsApi = navigator.permissions as Permissions | undefined;
      if (permissionsApi?.query) {
        const permission = await permissionsApi.query({ name: "geolocation" as PermissionName });
        if (permission.state === "denied") {
          setLocationStatus("Localisation bloquée par le navigateur");
          setLocationBlocked(true);
          return null;
        }

        setLocationStatus(
          permission.state === "granted" ? "Détection de votre position..." : "Merci d'autoriser la localisation"
        );
      }
    } catch {
      setLocationStatus(forcePrompt ? "Merci d'autoriser la localisation" : "Détection de votre position...");
    }

    return await new Promise<UserLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          locationRef.current = nextLocation;
          setLocation(nextLocation);
          setLocationBlocked(false);
          setLocationStatus("Localisation détectée");
          resolve(nextLocation);
        },
        (error) => {
          setLocationBlocked(true);
          setLocationStatus(
            error.code === error.PERMISSION_DENIED || error.code === 1
              ? "Localisation bloquée"
              : "Localisation indisponible"
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: forcePrompt ? 12000 : 8000 }
      );
    });
  }, []);

  const requestLocation = useCallback(() => {
    if (assistantScope !== "patient") {
      return;
    }
    void resolveBrowserLocation(true);
  }, [assistantScope, resolveBrowserLocation]);

  const fetchDoctorsForSpecialties = useCallback(
    async (specialties: string[], currentLocation: UserLocation | null) => {
      if (specialties.length === 0) {
        return [] as RecommendedDoctor[];
      }

      const results = await Promise.all(
        specialties.map((specialty) =>
          fetchRecommendedDoctors({
            targetSpecialty: specialty,
            location: currentLocation,
          })
        )
      );

      return deduplicateDoctors(results.flatMap((entry) => entry.recommendations));
    },
    []
  );

  const loadDoctors = useCallback(
    async (specialty: string, currentLocation: UserLocation | null) => {
      if (assistantScope !== "patient") {
        return;
      }

      setIsLoadingDoctors(true);
      try {
        await syncExpiredDoctorVacations();
        const docs = await fetchDoctorsForSpecialties([specialty], currentLocation);
        attachDoctorsToLatestAssistantMessage(docs);
      } catch {
        // silent fallback
      } finally {
        setIsLoadingDoctors(false);
      }
    },
    [assistantScope, attachDoctorsToLatestAssistantMessage, fetchDoctorsForSpecialties]
  );

  const handlePatientBookingRedirect = useCallback(
    async (text: string) => {
      if (assistantScope !== "patient") {
        return false;
      }

      const messageLanguage = detectMessageLanguage(text);
      const intentDetected = hasBookingIntent(text);

      if (!intentDetected) {
        return false;
      }

      const doctorFromText = findDoctorMention(text, doctorContext);
      let matchedDoctors: RecommendedDoctor[] = [];
      let activeDoctor = doctorFromText ?? null;

      if (!activeDoctor) {
        try {
          matchedDoctors = await searchDoctorsByMessage({
            message: text,
            specialties: extractExplicitSpecialties(text),
            location: locationRef.current,
            limit: 4,
          });
        } catch {
          matchedDoctors = [];
        }

        activeDoctor = matchedDoctors[0] ?? null;
      }

      if (!activeDoctor) {
        return false;
      }

      const doctorName = activeDoctor.full_name ?? "Médecin";
      const attachedDoctors = matchedDoctors.length > 0 ? matchedDoctors : [activeDoctor];

      await appendAssistantMessage(
        translateManualBookingReply(messageLanguage, "manual_booking_only_identified", {
          doctorName,
        }),
        { suggestedDoctors: attachedDoctors }
      );
      return true;
    },
    [appendAssistantMessage, assistantScope, doctorContext]
  );

  const ensureSessionForFirstMessage = useCallback(
    async (firstMessage: ChatMessage, sessionTitle?: string) => {
      if (sessionCreatedRef.current) {
        await history.appendMessage(firstMessage);
        return;
      }

      sessionCreatedRef.current = true;
      const sessionId = await history.createSession(sessionTitle ?? firstMessage.content);
      if (sessionId) {
        if (messages.length > 0 && messages[0].role === "assistant") {
          await history.appendMessage(messages[0]);
        }
        await history.appendMessage(firstMessage);
      }
    },
    [history, messages]
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Array<{ file: File; previewUrl?: string | null; kind: "image" | "pdf" }> = []) => {
      const trimmedText = text.trim();
      const normalizedAttachments = attachments.slice(0, 5);

      if ((!trimmedText && normalizedAttachments.length === 0) || isThinking || isAnalyzingAttachment) {
        return;
      }

      setIsThinking(true);
      if (normalizedAttachments.length > 0) {
        setIsAnalyzingAttachment(true);
      }

      let attachmentPayload:
        | Array<{
            fileName: string;
            mimeType: string;
            dataUrl: string;
          }>
        | null = null;

      try {
        attachmentPayload =
          normalizedAttachments.length > 0
            ? await Promise.all(
                normalizedAttachments.map(async (attachment) => ({
                  fileName: attachment.file.name,
                  mimeType: attachment.file.type,
                  dataUrl: await readFileAsDataUrl(attachment.file),
                }))
              )
            : null;

        const messageAttachments: ChatAttachment[] = normalizedAttachments.map((attachment, index) => ({
          name: attachment.file.name,
          mimeType: attachment.file.type,
          kind: attachment.kind,
          previewUrl:
            attachment.kind === "image"
              ? attachmentPayload?.[index]?.dataUrl ?? attachment.previewUrl ?? null
              : null,
        }));

        const userMessage: ChatMessage = {
          role: "user",
          content: trimmedText,
          attachments: messageAttachments,
          timestamp: Date.now(),
        };
        setMessages((previous) => [...previous, userMessage]);

        const isFirstUserMessage = messages.filter((message) => message.role === "user").length === 0;
        if (assistantScope === "patient" && isFirstUserMessage) {
          await resolveBrowserLocation(true);
        }

        await ensureSessionForFirstMessage(userMessage, buildSessionTitle(trimmedText, messageAttachments));

        if (attachmentPayload && normalizedAttachments.length > 0) {
          const historyForVisionApi = [...messages, userMessage].slice(-10).map((message) => ({
            role: message.role,
            content: message.content,
          }));

          const response = await fetch("/api/ai-vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userRole: assistantScope,
              userPrompt: trimmedText,
              attachments: attachmentPayload,
              history: historyForVisionApi,
            }),
          });

          const data = await parseApiJsonOrThrow<{ reply?: string; error?: string }>(
            response,
            language === "ar"
              ? "تعذر تحليل الملف حالياً. حاول مرة أخرى بعد قليل."
              : language === "en"
                ? "The document could not be analyzed right now. Please try again shortly."
                : "Impossible d'analyser le document pour le moment. Réessayez dans un instant."
          );

          await appendAssistantMessage(data.reply ?? "Analyse indisponible pour le moment.");
          return;
        }

        if (assistantScope === "patient" && trimmedText) {
          const handledBooking = await handlePatientBookingRedirect(trimmedText);
          if (handledBooking) {
            return;
          }

          if (isSimpleGreeting(trimmedText)) {
            const messageLanguage = detectMessageLanguage(trimmedText);
            const greetingReply =
              messageLanguage === "ar"
                ? "مرحباً. كيف يمكنني مساعدتك طبياً اليوم؟"
                : messageLanguage === "en"
                  ? "Hello. How can I help you medically today?"
                  : "Bonjour. Comment puis-je vous aider sur le plan médical aujourd'hui ?";
            await appendAssistantMessage(greetingReply);
            return;
          }
        }

        const allMessages = [...messages, userMessage];
        const historyForApi = allMessages.slice(-14).map((message) => ({
          role: message.role,
          content: message.content,
        }));

        const explicitSpecialties =
          assistantScope === "patient" ? extractExplicitSpecialties(text) : [];
        let promptDoctors: RecommendedDoctor[] = [];

        if (assistantScope === "patient" && explicitSpecialties.length > 0) {
          const currentLocation =
            locationRef.current ?? (locationBlocked ? null : await resolveBrowserLocation(true));
          const prefetchedDoctors = await fetchDoctorsForSpecialties(
            explicitSpecialties,
            currentLocation
          );

          if (prefetchedDoctors.length > 0) {
            promptDoctors = prefetchedDoctors;
            setDoctorContext(prefetchedDoctors);
          }
        }

        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyForApi,
            doctorsSummary: assistantScope === "patient" && promptDoctors.length > 0
              ? buildDoctorsSummary(promptDoctors)
              : undefined,
            locationBlocked,
            userRole: assistantScope,
          }),
        });

        const data = await parseApiJsonOrThrow<{
          reply?: string;
          specialty?: string | null;
          bodyZone?: string | null;
          isEmergency?: boolean;
          forceAll?: boolean;
          error?: string;
        }>(
          response,
          language === "ar"
            ? "تعذر الحصول على رد من المساعد حالياً. حاول مرة أخرى."
            : language === "en"
              ? "The assistant could not respond right now. Please try again."
              : "L'assistant ne peut pas répondre pour le moment. Réessayez."
        );

        await appendAssistantMessage(
          data.reply ?? "Une erreur est survenue.",
          assistantScope === "patient" && promptDoctors.length > 0
            ? { suggestedDoctors: promptDoctors }
            : undefined
        );

        if (assistantScope === "patient" && data.specialty) {
          const nextAnalysis: LunaAnalysis = {
            specialty: data.specialty,
            bodyZone: data.bodyZone ?? null,
            isEmergency: data.isEmergency ?? false,
            forceAll: data.forceAll ?? false,
          };
          setAnalysis(nextAnalysis);
          history.updateSessionMeta(data.specialty, data.bodyZone ?? null, data.isEmergency ?? false);

          if (promptDoctors.length > 0) {
            // Suggestions already attached to the assistant reply and cached in place.
          } else if (data.forceAll) {
            void loadDoctors(data.specialty, null);
          } else {
            const currentLocation = locationRef.current ?? (await resolveBrowserLocation(true));
            if (currentLocation) {
              void loadDoctors(data.specialty, currentLocation);
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
        await appendAssistantMessage(message);
      } finally {
        setIsThinking(false);
        setIsAnalyzingAttachment(false);
      }
    },
    [
      appendAssistantMessage,
      assistantScope,
      ensureSessionForFirstMessage,
      handlePatientBookingRedirect,
      history,
      isAnalyzingAttachment,
      isThinking,
      fetchDoctorsForSpecialties,
      loadDoctors,
        language,
        locationBlocked,
        messages,
        resolveBrowserLocation,
      ]
    );

  const resetChat = useCallback(() => {
    setMessages([createWelcomeMessage(userName ?? undefined, assistantScope, language)]);
    setAnalysis(null);
    setSuggestedDoctors([]);
    setDoctorContext([]);
    setIsThinking(false);
    sessionCreatedRef.current = false;
    restoredSessionIdRef.current = null;
    history.clearCurrentSession();
  }, [assistantScope, history, language, userName]);

  const loadPastSession = useCallback(
    async (sessionId: string) => {
      const previousMessages = await history.loadSession(sessionId);
      history.setCurrentSession(sessionId);
      sessionCreatedRef.current = true;

      if (previousMessages.length > 0) {
        setMessages(previousMessages);
        const lastSuggestedDoctors =
          [...previousMessages]
            .reverse()
            .find((message) => (message.suggestedDoctors?.length ?? 0) > 0)
            ?.suggestedDoctors ?? [];
        setSuggestedDoctors(lastSuggestedDoctors);
        setDoctorContext(lastSuggestedDoctors);
      } else {
        setMessages([createWelcomeMessage(userName ?? undefined, assistantScope, language)]);
        setSuggestedDoctors([]);
        setDoctorContext([]);
      }

      const sessionMeta = history.sessions.find((session) => session.id === sessionId);
      if (assistantScope === "patient" && sessionMeta?.specialty) {
        setAnalysis({
          specialty: sessionMeta.specialty,
          bodyZone: sessionMeta.body_zone,
          isEmergency: sessionMeta.is_emergency,
          forceAll: false,
        });
      } else {
        setAnalysis(null);
      }
    },
    [assistantScope, history, language, userName]
  );

  useEffect(() => {
    if (!history.currentSessionId || history.isLoadingHistory) {
      return;
    }

    if (restoredSessionIdRef.current === history.currentSessionId) {
      return;
    }

    if (messages.some((message) => message.role === "user")) {
      return;
    }

    restoredSessionIdRef.current = history.currentSessionId;
    void loadPastSession(history.currentSessionId);
  }, [history.currentSessionId, history.isLoadingHistory, loadPastSession, messages]);

  return {
    messages,
    isThinking,
    analysis,
    suggestedDoctors,
    location,
    locationStatus,
    locationBlocked,
    isLoadingDoctors,
    patientId,
    userRole,
    userName,
    userGender,
    userAvatarUrl,
    isAnalyzingAttachment,
    history,
    sendMessage,
    requestLocation,
    resetChat,
    loadPastSession,
  };
}
