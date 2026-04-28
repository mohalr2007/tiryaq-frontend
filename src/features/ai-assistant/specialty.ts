const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  Dermatologue: ["peau", "acné", "eczéma", "allergie cutanée", "tache", "rougeur"],
  Cardiologue: ["coeur", "poitrine", "palpitations", "tension", "hypertension", "douleur thoracique"],
  Pneumologue: ["respiration", "essoufflement", "asthme", "toux", "poumon"],
  "Gastro-entérologue": ["ventre", "estomac", "digestion", "nausée", "reflux", "foie"],
  Neurologue: ["tête", "migraine", "vertige", "mémoire", "nerf", "engourdissement"],
  Pédiatre: ["enfant", "bébé", "fièvre enfant", "vaccin", "croissance"],
  Gynécologue: ["grossesse", "cycle", "douleur pelvienne", "gynécologique"],
  ORL: ["oreille", "nez", "gorge", "sinus", "angine"],
  Ophtalmologue: ["vue", "oeil", "vision", "yeux", "flou"],
  "Médecin généraliste": ["fatigue", "fièvre", "douleur", "infection", "symptôme"],
};

const SPECIALTY_ALIASES: Record<string, string[]> = {
  "Médecin généraliste": [
    "medecin generaliste",
    "médecin généraliste",
    "generaliste",
    "généraliste",
    "generalist",
    "general practitioner",
    "family doctor",
    "medecine generale",
    "médecine générale",
    "gp",
  ],
  Dermatologue: ["dermatologue", "dermatologist", "dermato"],
  Cardiologue: ["cardiologue", "cardiologist"],
  Pneumologue: ["pneumologue", "pulmonologue", "pulmonologist"],
  "Gastro-entérologue": ["gastro enterologue", "gastro-entérologue", "gastroenterologue", "gastroenterologist"],
  Neurologue: ["neurologue", "neurologist"],
  Pédiatre: ["pediatre", "pédiatre", "pediatrician", "paediatrician"],
  Gynécologue: ["gynecologue", "gynécologue", "gynecologist", "gynaecologist"],
  ORL: ["orl", "ent", "otorhinolaryngologue", "otorhinolaryngologist"],
  Ophtalmologue: [
    "ophtalmologue",
    "ophthalmologist",
    "ophtalmo",
    "oculiste",
    "eye doctor",
    "docteur des yeux",
    "medecin des yeux",
    "médecin des yeux",
    "specialiste des yeux",
    "spécialiste des yeux",
    "yeux",
    "oeil",
    "oeils",
    "eyux",
  ],
  Orthopédiste: ["orthopediste", "orthopédiste", "orthopedist", "orthopaedist"],
  Urologue: ["urologue", "urologist"],
  Endocrinologue: ["endocrinologue", "endocrinologist"],
  Rhumatologue: ["rhumatologue", "rheumatologist"],
  Psychiatre: ["psychiatre", "psychiatrist"],
  Infectiologue: ["infectiologue", "infectiologist", "specialiste des infections", "spécialiste des infections"],
};

export const AI_DEFAULT_SPECIALTY = "Médecin généraliste";

function normalizeSpecialtyText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAiSpecialtyOptions() {
  return Object.keys(SPECIALTY_KEYWORDS);
}

export function detectSpecialties(symptoms: string) {
  const normalized = symptoms.toLowerCase();
  const scored = Object.entries(SPECIALTY_KEYWORDS)
    .map(([specialty, keywords]) => ({
      specialty,
      score: keywords.reduce((accumulator, keyword) => accumulator + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.map((entry) => entry.specialty);
}

export function getSpecialtySearchTerms(targetSpecialty: string) {
  const normalizedTarget = normalizeSpecialtyText(targetSpecialty);
  const matchedCanonical = Object.entries(SPECIALTY_ALIASES)
    .filter(([canonical, aliases]) => {
      const normalizedCanonical = normalizeSpecialtyText(canonical);
      return (
        normalizedTarget === normalizedCanonical ||
        normalizedTarget.includes(normalizedCanonical) ||
        normalizedCanonical.includes(normalizedTarget) ||
        aliases.some((alias) => {
          const normalizedAlias = normalizeSpecialtyText(alias);
          return (
            normalizedTarget === normalizedAlias ||
            normalizedTarget.includes(normalizedAlias) ||
            normalizedAlias.includes(normalizedTarget)
          );
        })
      );
    })
    .map(([canonical]) => canonical);

  const canonicalList = matchedCanonical.length > 0 ? matchedCanonical : [targetSpecialty];

  return Array.from(
    new Set(
      canonicalList.flatMap((canonical) => [
        normalizeSpecialtyText(canonical),
        ...(SPECIALTY_ALIASES[canonical]?.map((alias) => normalizeSpecialtyText(alias)) ?? []),
      ])
    )
  ).filter(Boolean);
}

export function specialtyMatchesQuery(doctorSpecialty: string | null | undefined, targetSpecialty: string) {
  const normalizedDoctorSpecialty = normalizeSpecialtyText(doctorSpecialty ?? "");
  if (!normalizedDoctorSpecialty) {
    return false;
  }

  const searchTerms = getSpecialtySearchTerms(targetSpecialty);
  return searchTerms.some(
    (term) =>
      normalizedDoctorSpecialty === term ||
      normalizedDoctorSpecialty.includes(term) ||
      term.includes(normalizedDoctorSpecialty)
  );
}

export function extractExplicitSpecialties(text: string) {
  const normalizedText = normalizeSpecialtyText(text);
  const matches = Object.entries(SPECIALTY_ALIASES)
    .map(([canonical, aliases]) => {
      const searchTerms = [canonical, ...aliases].map((item) => normalizeSpecialtyText(item));
      const positions = searchTerms
        .map((term) => normalizedText.indexOf(term))
        .filter((position) => position >= 0);

      if (positions.length === 0) {
        return null;
      }

      return {
        canonical,
        position: Math.min(...positions),
      };
    })
    .filter((entry): entry is { canonical: string; position: number } => entry !== null)
    .sort((left, right) => left.position - right.position);

  return matches.map((entry) => entry.canonical);
}
