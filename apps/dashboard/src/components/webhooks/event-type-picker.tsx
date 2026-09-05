"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { WEBHOOK_CHANNELS, eventsForChannel } from "./event-types";
import type { WebhookEventValue } from "./event-types";

/**
 * The event checklist shared by the add sheet and the details sheet. Grouped
 * by channel, with a header checkbox that toggles the whole group.
 */
export function EventTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: readonly string[];
  onChange: (next: WebhookEventValue[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  const toggle = (event: WebhookEventValue, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(event);
    else next.delete(event);
    onChange([...next] as WebhookEventValue[]);
  };

  const toggleChannel = (events: readonly WebhookEventValue[], checked: boolean) => {
    const next = new Set(selected);
    for (const event of events) {
      if (checked) next.add(event);
      else next.delete(event);
    }
    onChange([...next] as WebhookEventValue[]);
  };

  return (
    <div className="flex flex-col gap-3">
      {WEBHOOK_CHANNELS.map((channel) => {
        const options = eventsForChannel(channel.id);
        const events = options.map((option) => option.value);
        const selectedCount = events.filter((event) => selected.has(event)).length;
        const all = selectedCount === events.length;
        const some = selectedCount > 0 && !all;
        const headerId = `webhook-events-${channel.id}`;

        return (
          <fieldset
            key={channel.id}
            className={cn("rounded-md border", disabled && "opacity-60")}
            disabled={disabled}
          >
            <label
              htmlFor={headerId}
              className="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-3 py-2"
            >
              <Checkbox
                id={headerId}
                checked={all}
                indeterminate={some}
                onCheckedChange={(checked) => toggleChannel(events, checked === true)}
              />
              <span className="flex-1 text-sm font-medium">{channel.label}</span>
              <span className="text-xs text-muted-foreground">
                {selectedCount} of {events.length}
              </span>
            </label>
            <div className="grid gap-px sm:grid-cols-2">
              {options.map((option) => {
                const id = `webhook-event-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={selected.has(option.value)}
                      onCheckedChange={(checked) => toggle(option.value, checked === true)}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {option.value}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
