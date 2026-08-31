import type { Locale, Scene } from "@liveearth/domain/types";
import { copy } from "@/lib/i18n";
import { FeedRegistrationForm } from "./feed-registration-form";

export function AdminDashboard({
  scenes,
  locale,
  authorised,
  analysisDue,
  rightsAlerts,
}: {
  scenes: Scene[];
  locale: Locale;
  authorised: boolean;
  analysisDue: number;
  rightsAlerts: number;
}) {
  const t = copy[locale].admin;
  const live = scenes.filter((scene) => scene.health.state === "live").length;

  return (
    <div className="admin-layout">
      <section className="admin-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        {!authorised ? <p className="admin-gate-note">{t.gated}</p> : null}
      </section>

      <section className="ops-summary" aria-label="Operational summary">
        <div><span>Healthy signals</span><strong>{String(live).padStart(2, "0")}</strong><small>of {scenes.length}</small></div>
        <div><span>Analysis due</span><strong>{String(analysisDue).padStart(2, "0")}</strong><small>next sweep 05′</small></div>
        <div><span>Rights alerts</span><strong>{String(rightsAlerts).padStart(2, "0")}</strong><small>within 30 days</small></div>
      </section>

      <section className="source-register-section">
        <div className="admin-section-copy">
          <p className="eyebrow">{t.register}</p>
          <h2>{locale === "en" ? "A source is a contract before it is a camera." : "直播源首先是一份授权，然后才是镜头。"}</h2>
          <p>{locale === "en" ? "Every required right is explicit. A feed cannot enter health checks until the contract fields pass validation." : "每项必要权利都必须明确。授权字段未通过校验的直播源不会进入健康检查。"}</p>
        </div>
        {authorised ? <FeedRegistrationForm locale={locale} /> : null}
      </section>

      <section className="source-table-section">
        <div className="library-heading"><h2>{t.sources}</h2><span>{scenes.length}</span></div>
        <div className="source-table" role="table" aria-label={t.sources}>
          <div role="row" className="source-table-head">
            <span role="columnheader">Source</span><span role="columnheader">Channel</span><span role="columnheader">Latency</span><span role="columnheader">Analysis</span><span role="columnheader">{t.state}</span>
          </div>
          {scenes.map((scene) => (
            <div role="row" key={scene.id}>
              <span role="cell"><strong>{scene.city}</strong><small>{scene.media.attribution.name}</small></span>
              <span role="cell">{scene.primaryChannel}</span>
              <span role="cell">{scene.health.latencyMs} ms</span>
              <span role="cell">{Math.round(scene.analysis.confidence * 100)}%</span>
              <span role="cell"><i className={`health-dot health-dot--${scene.health.state}`} /> {scene.health.state}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
