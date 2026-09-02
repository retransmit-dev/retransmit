import type { Route } from "next";
import Link from "next/link";

import { CtaButton } from "@/components/marketing/cta-button";
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  itemListSchema,
  JsonLd,
} from "@/components/structured-data";
import { siteConfig } from "@/lib/site";

export type LinkedText = { label: string; href: string };
export type TableCell = string | LinkedText;
export type ComparisonTable = {
  columns: readonly string[];
  rows: readonly (readonly TableCell[])[];
  note?: string;
};

export type SeoSection = {
  title: string;
  subtitle?: string;
  body: readonly string[];
  table?: ComparisonTable;
  points?: readonly string[];
  sources?: readonly LinkedText[];
};

export type SeoContentPageProps = {
  href: Route;
  section: { name: string; href: Route };
  title: string;
  lead: string;
  summary: string;
  sections: readonly SeoSection[];
  resources: readonly { href: string; label: string; description: string }[];
  faqs: readonly { q: string; a: string }[];
  cta?: string;
  editorial?: {
    datePublished: string;
    dateModified: string;
    dateModifiedLabel: string;
    disclosure: string;
  };
  schemaItems?: readonly { name: string; url: string }[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function TableCellContent({ cell }: { cell: TableCell }) {
  if (typeof cell === "string") return <>{cell}</>;
  return (
    <a
      href={cell.href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-border underline-offset-4 hover:decoration-foreground"
    >
      {cell.label}
    </a>
  );
}

function DataTable({ table }: { table: ComparisonTable }) {
  return (
    <figure className="mt-6">
      <div className="overflow-x-auto rounded-[1rem] bg-card shadow-card">
        <table className="w-full min-w-176 border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {table.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-3 font-bold text-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border last:border-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={
                      cellIndex === 0
                        ? "px-4 py-3 font-semibold text-foreground"
                        : "px-4 py-3 leading-relaxed text-muted-foreground"
                    }
                  >
                    <TableCellContent cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? (
        <figcaption className="mt-3 text-sm text-muted-foreground">
          {table.note}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function SeoContentPage({
  href,
  section,
  title,
  lead,
  summary,
  sections,
  resources,
  faqs,
  cta,
  editorial,
  schemaItems,
}: SeoContentPageProps) {
  const trail = [
    { name: "Home", href: "/" },
    { name: section.name, href: section.href },
    { name: title, href },
  ] as const;

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          {trail.map((crumb, index) => (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {index < trail.length - 1 ? (
                <Link
                  href={crumb.href as Route}
                  className="transition-colors hover:text-foreground"
                >
                  {crumb.name}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {crumb.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mt-8 max-w-3xl">
        <h1 className="text-4xl text-balance md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
          {lead}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <CtaButton href={siteConfig.links.quickstart} size="sm">
            Get started
          </CtaButton>
          <CtaButton href={siteConfig.links.docs} tone="quiet" size="sm">
            Read the docs
          </CtaButton>
        </div>
        {editorial ? (
          <div className="mt-8 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              By the {siteConfig.name} team. Last updated{" "}
              <time dateTime={editorial.dateModified}>
                {editorial.dateModifiedLabel}
              </time>
              .
            </p>
            <p className="mt-1">{editorial.disclosure}</p>
          </div>
        ) : null}
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[16rem_1fr]">
        <nav
          aria-label="On this page"
          className="hidden self-start lg:sticky lg:top-24 lg:block"
        >
          <p className="text-sm font-medium">On this page</p>
          <ul className="mt-3 flex flex-col gap-2">
            {sections.map((item) => (
              <li key={item.title}>
                <a
                  href={`#${slugify(item.title)}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#questions-people-ask"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Questions people ask
              </a>
            </li>
          </ul>
        </nav>

        <div className="min-w-0">
          <p className="max-w-[68ch] text-base leading-relaxed text-muted-foreground">
            {summary}
          </p>

          {sections.map((item) => (
            <section
              key={item.title}
              id={slugify(item.title)}
              className="mt-14 scroll-mt-24"
            >
              <h2 className="text-2xl text-balance md:text-3xl">
                {item.title}
              </h2>
              {item.subtitle ? (
                <p className="mt-2 text-base font-medium text-muted-foreground">
                  {item.subtitle}
                </p>
              ) : null}
              {item.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-4 max-w-[68ch] text-base leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {item.table ? <DataTable table={item.table} /> : null}
              {item.points?.length ? (
                <ul className="mt-5 flex max-w-[68ch] flex-col gap-2.5">
                  {item.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground"
                    >
                      <span
                        aria-hidden
                        className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.sources?.length ? (
                <p className="mt-5 text-sm text-muted-foreground">
                  Sources:{" "}
                  {item.sources.map((source, index) => (
                    <span key={source.href}>
                      {index > 0 ? ", " : ""}
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                      >
                        {source.label}
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
            </section>
          ))}

          {cta ? (
            <div className="mt-14 rounded-[1rem] bg-muted p-8">
              <p className="max-w-[52ch] text-lg leading-relaxed font-medium">
                {cta}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <CtaButton href={siteConfig.links.quickstart} size="sm">
                  Get started
                </CtaButton>
                <CtaButton
                  href={siteConfig.links.github}
                  tone="quiet"
                  size="sm"
                  external
                >
                  View on GitHub
                </CtaButton>
              </div>
            </div>
          ) : null}

          <section className="mt-14">
            <h2 className="text-2xl md:text-3xl">Related resources</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {resources.map((resource) =>
                resource.href.startsWith("/") ? (
                  <Link
                    key={resource.href}
                    href={resource.href as Route}
                    className="rounded-[1rem] bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <p className="text-base font-semibold tracking-tight">
                      {resource.label}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {resource.description}
                    </p>
                  </Link>
                ) : (
                  <a
                    key={resource.href}
                    href={resource.href}
                    className="rounded-[1rem] bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <p className="text-base font-semibold tracking-tight">
                      {resource.label}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {resource.description}
                    </p>
                  </a>
                ),
              )}
            </div>
          </section>

          <section id="questions-people-ask" className="mt-14 scroll-mt-24">
            <h2 className="text-2xl md:text-3xl">Questions people ask</h2>
            <div className="mt-6 flex flex-col gap-8">
              {faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {faq.q}
                  </h3>
                  <p className="mt-2 max-w-[68ch] text-base leading-relaxed text-muted-foreground">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <JsonLd data={breadcrumbSchema(trail)} />
      <JsonLd data={faqSchema(faqs)} />
      {editorial ? (
        <JsonLd
          data={articleSchema({
            headline: title,
            description: lead,
            href,
            datePublished: editorial.datePublished,
            dateModified: editorial.dateModified,
          })}
        />
      ) : null}
      {schemaItems?.length ? (
        <JsonLd data={itemListSchema(schemaItems)} />
      ) : null}
    </article>
  );
}
