"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { EmailStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/api-types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { FileIcon, FileSpreadsheetIcon, FileTextIcon, ImageIcon } from "lucide-react";
import { Fragment } from "react";

type EmailDetails = RouterOutputs["email"]["get"];

export function EmailDetailsDialog({
  emailId,
  onClose,
}: {
  emailId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={emailId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <ErrorBoundary title="Could not load this email">
          {emailId !== null && <EmailDetailsBody emailId={emailId} />}
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

function EmailDetailsBody({ emailId }: { emailId: string }) {
  const details = useQuery(trpc.email.get.queryOptions({ id: emailId }));
  const email = details.data;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="truncate">{email?.subject ?? "Email"}</span>
          {email && <EmailStatusBadge status={email.status} />}
        </DialogTitle>
        <DialogDescription>
          {email ? `Sent ${formatDateTime(email.createdAt)}` : null}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        {details.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : email ? (
          <div className="flex flex-col gap-4 text-sm">
            <EmailAddresses email={email} />

            {email.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                {email.error}
              </p>
            )}

            <EmailBody html={email.html} text={email.text} />
            <EmailAttachments attachments={email.attachments} />
            <EmailEvents events={email.events} />
          </div>
        ) : null}
      </DialogBody>
    </>
  );
}

function EmailAddresses({ email }: { email: EmailDetails }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border p-3">
      <span className="text-muted-foreground">From</span>
      <span className="truncate">{email.from}</span>
      <span className="text-muted-foreground">To</span>
      <span className="truncate">{email.to.join(", ")}</span>
      {email.cc && email.cc.length > 0 && (
        <>
          <span className="text-muted-foreground">Cc</span>
          <span className="truncate">{email.cc.join(", ")}</span>
        </>
      )}
      {email.replyTo && email.replyTo.length > 0 && (
        <>
          <span className="text-muted-foreground">Reply-To</span>
          <span className="truncate">{email.replyTo.join(", ")}</span>
        </>
      )}
      <span className="text-muted-foreground">Subject</span>
      <span>{email.subject}</span>
      {email.tags && email.tags.length > 0 && (
        <>
          <span className="text-muted-foreground">Tags</span>
          <span className="flex flex-wrap gap-1">
            {email.tags.map((tag) => (
              <Badge key={tag.name} variant="secondary" className="font-mono text-xs">
                {tag.name}: {tag.value}
              </Badge>
            ))}
          </span>
        </>
      )}
    </div>
  );
}

function EmailBody({
  html,
  text,
}: {
  html: string | null | undefined;
  text: string | null | undefined;
}) {
  if (!html && !text) return null;
  return (
    <div>
      <h3 className="mb-2 font-medium">Message</h3>
      {html ? (
        <iframe
          title="Email body"
          sandbox=""
          srcDoc={html}
          className="h-96 w-full rounded-md border bg-white"
        />
      ) : (
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 font-sans">
          {text}
        </pre>
      )}
    </div>
  );
}

function attachmentIcon(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType === "application/pdf" || contentType.startsWith("text/")) return FileTextIcon;
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType === "text/csv") {
    return FileSpreadsheetIcon;
  }
  return FileIcon;
}

function EmailAttachments({ attachments }: { attachments: EmailDetails["attachments"] }) {
  if (attachments.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-medium">Attachments</h3>
      <ul className="flex flex-col gap-1.5">
        {attachments.map((attachment) => {
          const Icon = attachmentIcon(attachment.contentType);
          return (
            <li
              key={attachment.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate">{attachment.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(attachment.size)}
                  {attachment.inline ? " · inline" : ""}
                </p>
              </div>
              {attachment.downloadUrl ? (
                <a
                  href={attachment.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-medium underline-offset-4 hover:underline"
                >
                  Download
                </a>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">Expired</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Files are kept for 30 days after sending.
      </p>
    </div>
  );
}

function EmailEvents({ events }: { events: EmailDetails["events"] }) {
  return (
    <div>
      <h3 className="mb-2 font-medium">Events</h3>
      <div className="flex flex-col">
        {events.length === 0 ? (
          <p className="text-muted-foreground">No events recorded yet.</p>
        ) : (
          events.map((event, index) => (
            <div key={event.id}>
              {index > 0 && <Separator className="my-2" />}
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs">{event.type}</code>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
              {event.data && Object.keys(event.data).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Details
                  </summary>
                  <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border p-2 text-xs">
                    {Object.entries(event.data)
                      .filter(([, value]) => value !== "" && value != null)
                      .map(([key, value]) => (
                        <Fragment key={key}>
                          <span className="text-muted-foreground">{key}</span>
                          <span className="wrap-break-word">
                            {typeof value === "string"
                              ? value
                              : JSON.stringify(value)}
                          </span>
                        </Fragment>
                      ))}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
