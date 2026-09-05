"use client";

import { CopyButton } from "@/components/copy-button";

export type DnsRecord = {
  type: string;
  name: string;
  value: string;
  purpose: string;
  required: boolean;
};

const PURPOSE_LABELS: Record<string, string> = {
  dkim: "DKIM",
  dmarc: "DMARC",
  return_path: "Return-Path",
  spf: "SPF",
};

export function DnsRecords({ records }: { records: DnsRecord[] }) {
  return (
    <div className="flex flex-col gap-2">
      {records.map((record) => (
        <div key={`${record.type}:${record.name}`} className="rounded-md border p-3 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {record.type}
            </span>
            <span className="text-xs text-muted-foreground">
              {PURPOSE_LABELS[record.purpose] ?? record.purpose.toUpperCase()}
            </span>
            {!record.required && (
              <span className="text-xs text-muted-foreground">(recommended)</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">
              {record.name}
            </code>
            <CopyButton value={record.name} className="size-6" />
          </div>
          <div className="mt-1 flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {record.value}
            </code>
            <CopyButton value={record.value} className="size-6" />
          </div>
        </div>
      ))}
    </div>
  );
}
