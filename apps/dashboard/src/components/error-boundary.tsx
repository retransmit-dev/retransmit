"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Component } from "react";
import type { ReactNode } from "react";

/**
 * Keeps one broken section from taking the page down with it.
 *
 * Every data-bearing block on a screen (a table, a stats row, a chart, a
 * sheet body) sits in its own boundary, so a failed query renders a
 * "Try again" in that block's place and everything around it keeps working.
 * "Try again" clears the query error and remounts the block, which refetches.
 *
 * Works from server components too: a page can wrap a client section in it
 * without becoming a client component itself.
 */

export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error;
  reset?: () => void;
  title?: string;
}) {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{error.message}</EmptyDescription>
      </EmptyHeader>
      {reset && (
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcwIcon />
          Try again
        </Button>
      )}
    </Empty>
  );
}

type BoundaryProps = {
  children: ReactNode;
  title?: string;
  onReset: () => void;
};

class Boundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(thrown: unknown) {
    return {
      error: thrown instanceof Error ? thrown : new Error(String(thrown)),
    };
  }

  reset = () => {
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          reset={this.reset}
          title={this.props.title}
        />
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({
  children,
  title,
}: {
  children: ReactNode;
  /** Names the section in the fallback, e.g. "Could not load emails". */
  title?: string;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <Boundary onReset={reset} title={title}>
          {children}
        </Boundary>
      )}
    </QueryErrorResetBoundary>
  );
}
