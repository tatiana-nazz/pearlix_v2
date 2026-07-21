import { type KeyboardEvent, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

export type WorkspaceTab = { id: string; label: string };

interface WorkspaceTabsProps {
  tabs: readonly WorkspaceTab[];
  defaultTab: string;
  ariaLabel: string;
  onTabChange?: (tab: string) => void;
}

/** A shared URL-backed tab bar for the application's major workspaces. */
export function WorkspaceTabs({ tabs, defaultTab, ariaLabel, onTabChange }: WorkspaceTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("tab");
  const selected = tabs.some((tab) => tab.id === requested) ? requested! : defaultTab;

  useEffect(() => {
    if (requested && requested !== selected) {
      const next = new URLSearchParams(params);
      next.set("tab", selected);
      navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true });
    }
  }, [location.pathname, navigate, params, requested, selected]);

  function href(tab: string) {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    return `${location.pathname}?${next.toString()}`;
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? direction : -direction) + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    onTabChange?.(next.id);
    navigate(href(next.id));
    requestAnimationFrame(() => document.getElementById(`workspace-tab-${next.id}`)?.focus());
  }

  return <nav className="workspace-tabs" aria-label={ariaLabel}>
    {tabs.map((tab, index) => <Link key={tab.id} id={`workspace-tab-${tab.id}`} className="workspace-tab" to={href(tab.id)} aria-current={selected === tab.id ? "page" : undefined} onClick={() => onTabChange?.(tab.id)} onKeyDown={(event) => onKeyDown(event, index)}>{tab.label}</Link>)}
  </nav>;
}
