import type { ReactNode } from "react";
import { PageHeaderV2 } from "./v2";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return <PageHeaderV2 title={title} description={description ?? eyebrow} action={actions} />;
}
