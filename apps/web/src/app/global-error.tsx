"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeContent: "center",
            gap: "1rem",
            padding: "2rem",
            color: "#eee8db",
            background: "#101718",
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ letterSpacing: ".14em", textTransform: "uppercase", fontSize: ".7rem" }}>
            Signal interrupted
          </p>
          <h1 style={{ maxWidth: "14ch", margin: 0, fontFamily: "serif", fontSize: "clamp(3rem, 8vw, 7rem)", lineHeight: ".9" }}>
            Earth is still live. This page is not.
          </h1>
          <button
            type="button"
            onClick={reset}
            style={{ width: "fit-content", marginTop: "1rem", padding: ".8rem 1rem", border: "1px solid #eee8db", color: "#eee8db", background: "transparent", cursor: "pointer" }}
          >
            Reconnect
          </button>
        </main>
      </body>
    </html>
  );
}
