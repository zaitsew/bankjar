import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "../components/EmptyState";
import { ExampleCards } from "../components/ExampleCards";
import { ModeSwitch } from "../components/ModeSwitch";
import { OfferTable } from "../components/OfferTable";
import { PromptBox } from "../components/PromptBox";
import { today } from "../components/format";
import type { SearchParams } from "../components/params";
import { REPO_URL, TAGLINE, DESCRIPTION } from "../components/site";
import { getVariant } from "../components/variant";
import { search } from "../src/server/search";

export const metadata: Metadata = {
  title: { absolute: "BankJar: find the bank offer that pays you most" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TAGLINE, description: DESCRIPTION, url: "/" },
};

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const variant = await getVariant(await searchParams);
  const salary = search({ overrides: { goal: "salary" } });
  const top = salary.result.ranked.slice(0, 5);

  return (
    <div className={variant === "b" ? "v-b" : "v-a"}>
      <div className="wrap">
        <section className="hero flex flex-col items-center gap-6 pb-10 pt-12 text-center sm:pt-[14vh]">
          <h1 className="t-display max-w-[16ch]">
            Find the bank offer that pays you <span className="mark-word">most</span>
          </h1>
          <div className="w-full max-w-2xl">
            <PromptBox />
          </div>
          <ModeSwitch />
        </section>

        <div className="examples-wrap mx-auto max-w-4xl">
          <ExampleCards />
        </div>

        <section aria-labelledby="top-h" className="mt-14">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="top-h" className="font-semibold">
              Top salary offers right now
            </h2>
            <Link href="/leaderboard/salary" className="t-caption muted underline underline-offset-4">
              Full salary leaderboard
            </Link>
          </div>
          {top.length === 0 ? (
            <EmptyState title="No salary offers in the dataset yet.">
              Each offer is one YAML file.{" "}
              <a className="underline underline-offset-4" href={`${REPO_URL}#contributing-an-offer`} rel="noopener">
                Add the first one
              </a>
              .
            </EmptyState>
          ) : (
            <OfferTable rows={top} mode="mini" caption="Top five salary offers by first-year net value" today={today()} />
          )}
          <p className="t-caption muted mt-2">
            Net value is after 19% withholding and fees, for a default profile.{" "}
            <Link href="/methodology" className="underline underline-offset-4">
              How we rank
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
