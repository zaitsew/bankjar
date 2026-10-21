import { datasetVersion } from "../src/server/data";
import { dateLabel } from "./format";
import { REPO_URL } from "./site";
import { VariantSwitch } from "./VariantSwitch";

export function Footer() {
  const ds = datasetVersion();
  return (
    <footer className="footer">
      <div className="wrap t-caption flex flex-col gap-3">
        <p>
          <span>Not financial advice</span>
          <span className="dot-sep">Data CC BY 4.0</span>
          <span className="dot-sep">Code Apache-2.0</span>
          <span className="dot-sep">
            <a href={REPO_URL} rel="noopener">
              GitHub
            </a>
          </span>
        </p>
        <p className="num">
          Dataset {ds.version}: {ds.count} {ds.count === 1 ? "offer" : "offers"}
          {ds.latest_verified_on ? `, latest check ${dateLabel(ds.latest_verified_on)}` : ", none verified yet"}
        </p>
        <VariantSwitch />
      </div>
    </footer>
  );
}
