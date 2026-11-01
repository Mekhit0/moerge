import { ImageResponse } from "next/og";

export const alt = "moarge, salon software for Georgia: online booking, calendar, clients";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Latin text only: the built in font has no Georgian glyphs, and the page title carries the Georgian.
export default function OpenGraphImage() {
  const chips = ["Online booking 24/7", "Calendar", "Clients", "Reminders", "Earnings"];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fdf8f6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 44, fontWeight: 900 }}>m</div>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 4, color: "#1c1917" }}>MOARGE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.05, color: "#1c1917", maxWidth: 980 }}>Salon software for Georgia</div>
          <div style={{ fontSize: 34, color: "#57534e", maxWidth: 980 }}>Beauty salons, nail studios, barbershops and cosmetology clinics.</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {chips.map((chip) => (
            <div key={chip} style={{ display: "flex", padding: "12px 24px", borderRadius: 999, background: "white", border: "2px solid #fecdd3", color: "#be123c", fontSize: 26, fontWeight: 700 }}>{chip}</div>
          ))}
          <div style={{ display: "flex", padding: "12px 24px", borderRadius: 999, background: "#e11d48", color: "white", fontSize: 26, fontWeight: 700 }}>moarge.com</div>
        </div>
      </div>
    ),
    size
  );
}
