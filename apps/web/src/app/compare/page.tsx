import type { Metadata } from "next";
import Link from "next/link";

import {
  breadcrumbSchema,
  itemListSchema,
  JsonLd,
} from "@/components/structured-data";
import { pageMetadata } from "@/lib/page-metadata";
import { getPage, pagesInGroup } from "@/lib/pages";

const HREF = "/compare";

export const metadata: Metadata = pageMetadata(HREF);

export default function ComparePage() {
  const page = getPage(HREF);
  const pages = pagesInGroup("compare").filter((entry) => entry.href !== HREF);
  const trail = [
    { name: "Home", href: "/" },
    { name: "Compare", href: HREF },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
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
              Compare
            </span>
          </li>
        </ol>
      </nav>

      <header className="mt-8 max-w-3xl">
        <h1 className="text-4xl text-balance md:text-5xl">
          Compare email APIs
        </h1>
        <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
          {page.description}
        </p>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-[1rem] bg-card p-6 shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <h2 className="text-lg tracking-tight">{entry.label}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {entry.description}
            </p>
          </Link>
        ))}
      </div>

      <JsonLd data={breadcrumbSchema(trail)} />
      <JsonLd
        data={itemListSchema(
          pages.map((entry) => ({ name: entry.title, url: entry.href })),
        )}
      />
    </div>
  );
}
