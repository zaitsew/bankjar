import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap pt-16">
      <h1 className="t-title">We do not have that page</h1>
      <p className="muted mt-2">The offer may have expired and left the dataset.</p>
      <div className="mt-4 flex gap-3">
        <Link href="/" className="btn btn-primary">
          Search offers
        </Link>
        <Link href="/leaderboard" className="btn">
          See leaderboards
        </Link>
      </div>
    </div>
  );
}
