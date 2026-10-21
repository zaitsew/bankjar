import Link from "next/link";
import { EXAMPLES, searchHref } from "./examples";
import { ExampleIcon } from "./icons";

export function ExampleCards({ heading = "Try one of these" }: { heading?: string }) {
  return (
    <section aria-labelledby="examples-h">
      <h2 id="examples-h" className="sr-only">
        {heading}
      </h2>
      <ul className="example-grid grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <li key={ex.title} className="contents">
            <Link href={searchHref(ex.prompt)} className="card">
              <span className="card-icon">
                <ExampleIcon name={ex.icon} />
              </span>
              <span className="font-semibold">{ex.title}</span>
              <span className="t-caption muted">{ex.prompt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
