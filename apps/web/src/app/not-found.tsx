import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found" id="main-content">
      <p className="eyebrow">404 · Off the map</p>
      <h1>This scene has moved on.</h1>
      <p>LiveEarth only keeps the present. Return to the latest edition.</p>
      <Link className="text-link" href="/en">
        Earth Top Now <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}
