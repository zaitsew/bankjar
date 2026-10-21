"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap pt-16">
      <h1 className="t-title">Could not load this page</h1>
      <p className="muted mt-2">Check your connection and try again. If it keeps failing, open an issue on GitHub.</p>
      <button type="button" className="btn btn-primary mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
