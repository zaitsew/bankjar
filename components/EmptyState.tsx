import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel" role="status">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 muted">{children}</div>}
    </div>
  );
}
