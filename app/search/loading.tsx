export default function Loading() {
  return (
    <div className="wrap pt-10" role="status" aria-label="Loading offers">
      <div className="skeleton h-9 w-64" />
      <div className="skeleton mt-4 h-16 w-full max-w-3xl" />
      <div className="skeleton mt-8 h-64 w-full" />
    </div>
  );
}
