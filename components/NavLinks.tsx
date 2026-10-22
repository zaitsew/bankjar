"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgentIcon, BoardIcon, ColumnsIcon, PhoneIcon, ScaleIcon, SearchIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Search", Icon: SearchIcon, match: (p: string) => p === "/" || p.startsWith("/search") },
  { href: "/leaderboard", label: "Leaderboards", Icon: BoardIcon, match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/apps", label: "Bank apps", Icon: PhoneIcon, match: (p: string) => p.startsWith("/apps") },
  { href: "/compare", label: "Side by side", Icon: ColumnsIcon, match: (p: string) => p.startsWith("/compare") },
  { href: "/agents", label: "For agents", Icon: AgentIcon, match: (p: string) => p.startsWith("/agents") },
  { href: "/methodology", label: "Methodology", Icon: ScaleIcon, match: (p: string) => p.startsWith("/methodology") },
];

export function NavLinks({ label }: { label: string }) {
  const path = usePathname() ?? "/";
  return (
    <nav aria-label={label} className="nav">
      {ITEMS.map(({ href, label: text, Icon, match }) => (
        <Link
          key={href}
          href={href}
          className="nav-link"
          aria-current={match(path) ? "page" : undefined}
          aria-label={text}
        >
          <Icon />
          <span className="nav-label" aria-hidden="true">
            {text}
          </span>
        </Link>
      ))}
    </nav>
  );
}
