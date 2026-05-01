import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.28), transparent 28%), linear-gradient(135deg, #081121 0%, #0f172a 55%, #0b2346 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
          padding: "56px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 52,
            top: 48,
            width: 220,
            height: 220,
            borderRadius: 9999,
            background: "rgba(37, 99, 235, 0.18)",
            filter: "blur(8px)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 36,
            padding: 40,
            background: "rgba(255,255,255,0.04)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: "white",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                T
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                  }}
                >
                  TIRYAQ
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  Plateforme medicale intelligente
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderRadius: 9999,
                background: "rgba(37,99,235,0.18)",
                color: "#bfdbfe",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Smart Medical Ecosystem
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 760,
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 78,
                lineHeight: 1.02,
                fontWeight: 800,
                letterSpacing: "-0.05em",
              }}
            >
              <span>Une plateforme claire</span>
              <span>pour patients et praticiens.</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              <span>
                Assistant medical, recherche de medecins, rendez-vous, communaute
                et suivi professionnel dans une experience unifiee.
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {["AI Guidance", "Doctor Search", "Bookings", "Prescriptions"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 16px",
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 18,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
