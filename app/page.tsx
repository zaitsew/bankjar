import { allOffers } from "../src/server/data";

// Placeholder home page. The UI lane replaces it.
export default function Home() {
  const count = allOffers().length;
  return (
    <main className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="text-4xl font-semibold">BankJar</h1>
      <p className="mt-4 opacity-80">
        {count} {count === 1 ? "offer" : "offers"} in the dataset.
      </p>
    </main>
  );
}
