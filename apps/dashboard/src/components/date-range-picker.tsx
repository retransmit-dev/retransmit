"use client"

import { endOfDay, format, isSameDay, startOfDay, subDays } from "date-fns"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { useState } from "react"
import type { DateRange as DayPickerRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type DateRange = { from: Date; to: Date }

const PRESETS: { label: string; range: () => DateRange }[] = [
  {
    label: "Today",
    range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: "Yesterday",
    range: () => {
      const day = subDays(new Date(), 1)
      return { from: startOfDay(day), to: endOfDay(day) }
    },
  },
  ...[3, 7, 15, 30].map((days) => ({
    label: `Last ${days} days`,
    range: () => ({
      from: startOfDay(subDays(new Date(), days - 1)),
      to: endOfDay(new Date()),
    }),
  })),
]

function matchesPreset(preset: DateRange, value: DateRange): boolean {
  return isSameDay(preset.from, value.from) && isSameDay(preset.to, value.to)
}

/** Reads "Last 7 days" when the range is a preset, otherwise the dates. */
function formatRange(range: DateRange): string {
  const preset = PRESETS.find((candidate) => matchesPreset(candidate.range(), range))
  if (preset) return preset.label
  if (isSameDay(range.from, range.to)) return format(range.from, "MMM d")
  return `${format(range.from, "MMM d")} - ${format(range.to, "MMM d")}`
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const [open, setOpen] = useState(false)

  const apply = (range: DateRange) => {
    onChange(range)
    setOpen(false)
  }

  const handleSelect = (range: DayPickerRange | undefined) => {
    if (!range?.from) return
    // Keep the picker open until the second click completes the range.
    if (range.to && !isSameDay(range.from, range.to)) {
      apply({ from: startOfDay(range.from), to: endOfDay(range.to) })
    } else {
      onChange({ from: startOfDay(range.from), to: endOfDay(range.to ?? range.from) })
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label="Date range"
            className="w-44 justify-between font-normal"
          >
            {formatRange(value)}
            <ChevronDownIcon
              className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col gap-0.5 border-r p-2">
            {PRESETS.map((preset) => {
              const range = preset.range()
              const active = matchesPreset(range, value)
              return (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-between gap-4 font-normal"
                  onClick={() => apply(range)}
                >
                  {preset.label}
                  {active && <CheckIcon className="size-4" strokeWidth={2.5} />}
                </Button>
              )
            })}
          </div>
          <Calendar
            mode="range"
            selected={{ from: value.from, to: value.to }}
            onSelect={handleSelect}
            defaultMonth={value.to}
            disabled={{ after: new Date() }}
            numberOfMonths={1}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
