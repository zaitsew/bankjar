import Link from "next/link";
import { JarGlyph } from "./icons";

export function Logo({ word = true }: { word?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="BankJar home">
      <JarGlyph />
      {word && <span className="logo-word">BankJar</span>}
    </Link>
  );
}
