"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tables sit bare on the page; there is no frame around them. The header is
 * a bordered, rounded pill a step off the page, a 1px spacer separates it
 * from the body, and body rows are divided by hairline rules on the cells.
 * Hover fills the row, and the first and last rows round their outer
 * corners so the fill never pokes out square.
 *
 * Borders are `separate` rather than collapsed so header cells can carry a
 * radius; row rules therefore live on the cells, not the rows. Ported from
 * discolaire's data table.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-separate border-spacing-0 text-sm [&_tr:not(:last-child)_td]:border-b",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <>
      <thead
        data-slot="table-header"
        className={cn("[&_tr]:hover:bg-transparent", className)}
        {...props}
      />
      {/* Spacer between the header pill and the first row. */}
      <tbody aria-hidden="true" className="table-row h-1" />
    </>
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "font-medium [&_td]:border-t [&_td]:bg-muted/50",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors hover:bg-accent/50 has-aria-expanded:bg-accent/50 data-[state=selected]:bg-muted",
        "[&:first-child>td:first-child]:rounded-tl-lg [&:first-child>td:last-child]:rounded-tr-lg [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "relative h-9 border-y border-border bg-muted px-3 text-left align-middle font-medium whitespace-nowrap text-foreground select-none first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-10 px-3 py-1.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
