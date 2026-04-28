const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127(?:\.\d{1,3}){3}$/,
  /^10(?:\.\d{1,3}){3}$/,
  /^192\.168(?:\.\d{1,3}){2}$/,
  /^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/,
];

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function isPrivateHostname(hostname: string) {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isPrivateOrigin(origin: string) {
  try {
    return isPrivateHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function resolvePrescriptionPublicOrigin(params?: {
  configuredOrigin?: string | null;
  runtimeOrigin?: string | null;
}) {
  const configuredOrigin = params?.configuredOrigin?.trim() ? trimTrailingSlashes(params.configuredOrigin.trim()) : null;
  const runtimeOrigin = params?.runtimeOrigin?.trim() ? trimTrailingSlashes(params.runtimeOrigin.trim()) : null;

  if (configuredOrigin) {
    if (runtimeOrigin && isPrivateOrigin(configuredOrigin)) {
      return runtimeOrigin;
    }
    return configuredOrigin;
  }

  if (runtimeOrigin) {
    return runtimeOrigin;
  }

  return "http://localhost:3000";
}

export function buildPrescriptionPublicUrl(
  publicToken: string | null | undefined,
  params?: {
    configuredOrigin?: string | null;
    runtimeOrigin?: string | null;
    print?: boolean;
  }
) {
  if (!publicToken) {
    return null;
  }

  const origin = resolvePrescriptionPublicOrigin(params);
  const suffix = params?.print ? "?print=1" : "";
  return `${origin}/ordonnance/${publicToken}${suffix}`;
}

export function isSecurePrescriptionPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) {
    return false;
  }

  try {
    return new URL(publicUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function isPrivatePrescriptionPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) {
    return false;
  }

  try {
    const { hostname } = new URL(publicUrl);
    return isPrivateHostname(hostname);
  } catch {
    return false;
  }
}
