import Link from "next/link";

import { breadcrumbSchema, JsonLd } from "@/components/structured-data";
import type { LegalDoc } from "@/lib/legal-content";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const trail = [
    { name: "Home", href: "/" },
    { name: doc.title, href: doc.href },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            <span aria-current="page" className="text-foreground">
              {doc.title}
            </span>
          </li>
        </ol>
      </nav>

      <header className="mt-8">
        <h1 className="text-4xl text-balance md:text-5xl">{doc.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated {doc.updatedLabel}
        </p>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          {doc.intro}
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        {doc.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl tracking-tight">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-3 leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
            {section.points?.length ? (
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
                {section.points.map((point) => (
                  <li key={point} className="leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <JsonLd data={breadcrumbSchema(trail)} />
    </div>
  );
}
