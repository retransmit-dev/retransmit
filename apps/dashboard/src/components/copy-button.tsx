"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import { toast } from "sonner";

/** Copies `value` to the clipboard and flips to a check mark for a moment. */
export function CopyButton({
  value,
  label = "Copy value",
  toastMessage,
  variant = "ghost",
  className,
  iconClassName = "size-3",
}: {
  value: string;
  label?: string;
  /** Shown as a toast after copying; omit for a silent copy. */
  toastMessage?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  iconClassName?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant={variant}
      size="icon"
      className={cn("shrink-0", className)}
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (toastMessage) toast.success(toastMessage);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <CheckIcon className={iconClassName} />
      ) : (
        <CopyIcon className={iconClassName} />
      )}
    </Button>
  );
}
