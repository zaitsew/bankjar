import type { SVGProps } from "react";
import type { IconName } from "./examples";

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);
export const BoardIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Svg>
);
export const PhoneIcon = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M11 18h2" />
  </Svg>
);
export const ColumnsIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="16" rx="1.5" />
    <rect x="13" y="4" width="7" height="16" rx="1.5" />
  </Svg>
);
export const AgentIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 8 4 4-4 4M12 17h7" />
  </Svg>
);
export const ScaleIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v16M7 20h10M5 8h14" />
    <path d="m5 8-2.5 6a3 3 0 0 0 5 0L5 8Zm14 0-2.5 6a3 3 0 0 0 5 0L19 8Z" />
  </Svg>
);
export const ArrowUpIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);
export const WalletIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="8" width="16" height="11" rx="2.5" />
    <circle cx="15.5" cy="13.5" r="1" />
  </Svg>
);
export const JarIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h8M9 4v2.2c-2.2.8-3.5 2.6-3.5 4.8v6a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3v-6c0-2.2-1.3-4-3.5-4.8V4" />
    <path d="M9 12h6" />
  </Svg>
);
export const CardIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M3 10h18M7 15h3" />
  </Svg>
);
export const GlobeIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5Z" />
  </Svg>
);
export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const GiftIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="9" width="16" height="11" rx="1.5" />
    <path d="M3 9h18v3H3zM12 9v11M12 9c-2.5 0-4-1-4-2.5S9.5 4 12 7c2.5-3 4-1.5 4 0S14.5 9 12 9Z" />
  </Svg>
);
export const ExternalIcon = (p: P) => (
  <Svg {...p} width="12" height="12" strokeWidth="2">
    <path d="M7 17 17 7M9 7h8v8" />
  </Svg>
);

const BY_NAME: Record<IconName, (p: P) => React.ReactElement> = {
  wallet: WalletIcon,
  jar: JarIcon,
  card: CardIcon,
  globe: GlobeIcon,
  clock: ClockIcon,
  gift: GiftIcon,
};

export function ExampleIcon({ name }: { name: IconName }) {
  const C = BY_NAME[name];
  return <C />;
}

/** The jar glyph. Matches app/icon.svg. */
export function JarGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="14" height="4" rx="1.5" fill="currentColor" />
      <path
        d="M10 8h12v1.5c2.5 1.2 4 3.5 4 6.5v8.5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V16c0-3 1.5-5.3 4-6.5V8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M11 20h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
