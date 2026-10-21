import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Markdown } from "../../components/Markdown";
import { REPO_URL } from "../../components/site";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How BankJar ranks bank offers: one scale in euros you keep, after tax and fees, with every rule in plain words.",
  alternates: { canonical: "/methodology" },
  openGraph: { title: "BankJar methodology", url: "/methodology" },
};

function readDoc(): string {
  return fs.readFileSync(path.join(process.cwd(), "docs", "METHODOLOGY.md"), "utf8");
}

export default function MethodologyPage() {
  const md = readDoc();
  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Methodology</h1>
      <p className="t-caption muted mt-2">
        This page is rendered from{" "}
        <a className="underline underline-offset-4" href={`${REPO_URL}/blob/main/docs/METHODOLOGY.md`} rel="noopener">
          docs/METHODOLOGY.md
        </a>
        . The code is{" "}
        <a className="underline underline-offset-4" href={`${REPO_URL}/blob/main/src/core/score.ts`} rel="noopener">
          src/core/score.ts
        </a>
        .
      </p>
      <div className="mt-4">
        <Markdown source={md} skipTitle />
      </div>
    </div>
  );
}
