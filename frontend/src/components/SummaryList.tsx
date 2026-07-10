import type { ReactNode } from "react";

import { EmptyState } from "./EmptyState";
import { SectionHeader } from "./SectionHeader";

interface SummaryListProps<T> {
  title: string;
  description?: string;
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => ReactNode;
}

export function SummaryList<T>({ title, description, items, emptyMessage, renderItem }: SummaryListProps<T>) {
  return (
    <section className="summary-list">
      <SectionHeader title={title} description={description} />
      {items.length ? <ul>{items.map(renderItem)}</ul> : <EmptyState title={emptyMessage} />}
    </section>
  );
}
