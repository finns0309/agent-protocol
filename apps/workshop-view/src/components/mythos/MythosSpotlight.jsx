import { Cartridge } from "../Cartridge.jsx";
import { StatPill } from "../StatPill.jsx";
import { cartridgeDataForScenario, formatWorldType, templateLabel } from "../../lib/workshop-ui.js";

export function MythosSpotlight({ mythos, theme, templates, launches, launchDrafts, onOpenLaunch, showcaseMeta }) {
  const running = launches.some((launch) => launch.scenarioId === mythos.id && launch.status !== "stopped");
  const viewLabel = templateLabel(
    templates,
    launchDrafts[mythos.id]?.observerTemplate || mythos.recommendedObserverTemplate || "chat"
  );
  const cast = (mythos.profiles || [])
    .slice(0, 3)
    .map((profile) => profile.displayName)
    .filter(Boolean);
  const highlights = (mythos.highlights || []).slice(0, 3).filter(Boolean);
  const featureTags = [
    formatWorldType(mythos.worldType),
    ...(mythos.tags || []).slice(0, 3)
  ].filter(Boolean);
  const leadCopy = mythos.seedSummary || mythos.description;
  const recommendationNote =
    mythos.defaultLaunch?.note ||
    mythos.notes ||
    (viewLabel ? `Best in ${viewLabel}.` : "");

  return (
    <div className="mythos-spotlight">
      <div className="focus-kicker">Mythos</div>
      <h1 className="focus-title focus-title-serif">{mythos.name}</h1>

      <div className="mythos-detail-main mythos-detail-main-featured">
        <div className="mythos-hero-strip">
          <div className="mythos-hero-copy">
            <p className="mythos-lead">{leadCopy}</p>
            {featureTags.length ? (
              <div className="mythos-feature-tags">
                {featureTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mythos-featured-card">
            <Cartridge data={cartridgeDataForScenario(mythos, theme)} size="lg" className="is-static" />
          </div>
        </div>

        <div className="mythos-detail-grid">
          {cast.length ? (
            <div className="mythos-detail-block">
              <div className="mythos-detail-label">Cast</div>
              <div className="mythos-detail-body">{cast.join(" · ")}</div>
            </div>
          ) : null}

          {highlights.length ? (
            <div className="mythos-detail-block">
              <div className="mythos-detail-label">Highlights</div>
              <div className="mythos-detail-body">
                <ul className="mythos-detail-list">
                  {highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {showcaseMeta?.promise ? (
            <div className="mythos-detail-block">
              <div className="mythos-detail-label">Demo Promise</div>
              <div className="mythos-detail-body">{showcaseMeta.promise}</div>
            </div>
          ) : null}

          {mythos.starterPrompt ? (
            <div className="mythos-detail-block mythos-detail-block-wide">
              <div className="mythos-detail-label">Opening Scene</div>
              <div className="mythos-detail-body mythos-scene-copy">{mythos.starterPrompt}</div>
            </div>
          ) : null}
        </div>

        <div className="mythos-command-bar">
          <div className="stats-row mythos-stats-row">
            <StatPill value={mythos.channelBlueprints?.length || 0} label="channels" />
            <StatPill value={mythos.profileCount || mythos.profiles?.length || 0} label="agents" />
            <StatPill value={viewLabel} label="best view" isText />
          </div>

          <div className="mythos-command-actions">
            <div className="action-row mythos-action-row">
              <button className="button button-primary" disabled={running} onClick={() => onOpenLaunch(mythos.id)} type="button">
                {running ? "Live" : "Launch"}
              </button>
            </div>
            {showcaseMeta?.label ? <div className="mythos-feature-badge">{showcaseMeta.label}</div> : null}
            {recommendationNote ? (
              <p className="mythos-view-note">{recommendationNote}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
