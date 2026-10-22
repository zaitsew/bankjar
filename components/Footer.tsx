import Link from "next/link";
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
        <nav aria-label="Legal and help">
          <Link href="/privacy">Privacy</Link>
          <span className="dot-sep">
            <Link href="/terms">Terms</Link>
          </span>
          <span className="dot-sep">
            <Link href="/support">Support</Link>
          </span>
          <span className="dot-sep">
            <Link href="/connect">Add to Claude or ChatGPT</Link>
          </span>
        </nav>
        <p className="num">
          Dataset {ds.version}: {ds.count} {ds.count === 1 ? "offer" : "offers"}
          {ds.latest_verified_on ? `, latest check ${dateLabel(ds.latest_verified_on)}` : ", none verified yet"}
        </p>
        <VariantSwitch />
      </div>
    </footer>
  );
}
