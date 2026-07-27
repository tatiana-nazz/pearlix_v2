import { AlertCircle, CheckCircle2, ChevronRight, Circle, Info, Lock, MoreHorizontal, Search, X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes } from "react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";

export function Button({ children, variant = "primary", compact, loading = false, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; compact?: boolean; loading?: boolean }) { return <button {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={["v2-button", variant === "primary" ? "" : variant, compact ? "compact" : "", props.className].filter(Boolean).join(" ")}>{children}</button>; }
export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button {...props} className={["v2-icon-button", props.className].filter(Boolean).join(" ")} aria-label={label} data-tooltip={label}>{children}</button>; }
type ActionMenuProps = PropsWithChildren<{ label: string; children: ReactNode }>;
const ActionMenuContext = createContext<(() => void) | null>(null);

export function ActionMenu({ label, children }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const placeMenu = () => {
      const triggerElement = trigger.current;
      if (!triggerElement) return;
      const bounds = triggerElement.getBoundingClientRect();
      const menuWidth = 220;
      const isRtl = getComputedStyle(triggerElement).direction === "rtl";
      const preferredLeft = isRtl ? bounds.left + bounds.width - menuWidth : bounds.right - menuWidth;
      setPosition({ top: Math.min(bounds.bottom + 6, window.innerHeight - 48), left: Math.max(16, Math.min(preferredLeft, window.innerWidth - menuWidth - 16)) });
    };
    placeMenu();
    const closeForOutsideClick = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeForEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    };
    document.addEventListener("pointerdown", closeForOutsideClick);
    document.addEventListener("keydown", closeForEscape);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsideClick);
      document.removeEventListener("keydown", closeForEscape);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      window.setTimeout(() => trigger.current?.focus(), 0);
    };
  }, [open]);

  function focusFirstItem() { menu.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus(); }
  return <ActionMenuContext.Provider value={() => setOpen(false)}><div className="v2-action-menu" onClick={(event) => event.stopPropagation()}>
    <button ref={trigger} type="button" className="v2-icon-button v2-action-menu-trigger" aria-label={label} data-tooltip={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); window.setTimeout(focusFirstItem, 0); } }}><MoreHorizontal size={20} aria-hidden="true" /></button>
    {open ? <div ref={menu} className="v2-action-menu-popover" style={position} role="menu" aria-label={label} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []); const index = items.indexOf(document.activeElement as HTMLElement); if (items.length) { event.preventDefault(); items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus(); } } }}>{children}</div> : null}
  </div></ActionMenuContext.Provider>;
}

export function ActionMenuItem({ children, danger = false, onSelect, disabled = false }: { children: ReactNode; danger?: boolean; onSelect: () => void; disabled?: boolean }) {
  const close = useContext(ActionMenuContext);
  return <button type="button" role="menuitem" className={["v2-action-menu-item", danger ? "danger" : ""].filter(Boolean).join(" ")} disabled={disabled} onClick={() => { onSelect(); close?.(); }}>{children}</button>;
}

export function ActionMenuSeparator() { return <div className="v2-action-menu-separator" role="separator" />; }
export function PageHeaderV2({ title, description, action }: { title:string; description?:string; action?:ReactNode }) { return <div className="page-header"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{action ? <div className="page-header-actions">{action}</div> : null}</div>; }
export function SectionHeading({ title, description }: { title:string; description?:string }) { return <div className="section-header"><h3>{title}</h3>{description ? <p>{description}</p> : null}</div>; }
export function SurfaceCard({ children, major = false, className }: PropsWithChildren<{ major?:boolean; className?:string }>) { return <section className={["v2-card", major ? "major" : "", className].filter(Boolean).join(" ")}>{children}</section>; }
export type KpiTone = "blue" | "violet" | "teal" | "green" | "amber" | "orange" | "rose";
export function KpiCard({ icon, label, value, support, tone = "blue" }: { icon:ReactNode; label:string; value:string|number; support?:string; tone?:KpiTone }) { return <SurfaceCard className={`v2-kpi ${tone}`}><div className="kpi-icon">{icon}</div><p>{label}</p><strong>{value}</strong><span className="v2-kpi-support" aria-hidden={support ? undefined : "true"}>{support ?? ""}</span></SurfaceCard>; }

const statusMeta: Record<string, { tone:string; icon:typeof Circle }> = {
  ACTIVE:{ tone:"success", icon:CheckCircle2 }, AVAILABLE:{ tone:"success", icon:CheckCircle2 }, COMPLETED:{ tone:"success", icon:CheckCircle2 }, PAID:{ tone:"success", icon:CheckCircle2 }, CONVERTED_TO_INVOICE:{ tone:"success", icon:CheckCircle2 },
  UPCOMING:{ tone:"info", icon:Info }, CHECKED_IN:{ tone:"info", icon:Info },
  ON_LEAVE:{ tone:"warning", icon:AlertCircle }, AVAILABLE_OVERRIDE:{ tone:"warning", icon:AlertCircle }, NEEDS_RESCHEDULE:{ tone:"warning", icon:AlertCircle }, UNPAID:{ tone:"warning", icon:AlertCircle }, PARTIALLY_PAID:{ tone:"warning", icon:AlertCircle }, PENDING:{ tone:"warning", icon:AlertCircle },
  CANCELLED:{ tone:"danger", icon:X }, NO_SHOW:{ tone:"danger", icon:X }, FAILED:{ tone:"danger", icon:AlertCircle }, DISMISSED:{ tone:"danger", icon:AlertCircle },
  INACTIVE:{ tone:"neutral", icon:Circle }, UNAVAILABLE:{ tone:"neutral", icon:Circle }, ARCHIVED:{ tone:"neutral", icon:Circle }, NOT_RUN:{ tone:"neutral", icon:Circle }, AI_COMPLETED:{ tone:"ai", icon:Info },
};
export function StatusBadge({ status, label, className }: { status:string; label?:string; className?:string }) { const machineStatus = status.trim().toUpperCase().replace(/[\s-]+/g, "_"); const text = label ?? machineStatus.split("_").join(" "); const meta = statusMeta[machineStatus] ?? { tone:"neutral", icon:Circle }; const Icon = meta.icon; return <span className={["v2-status", meta.tone, className].filter(Boolean).join(" ")} data-status={machineStatus} aria-label={`Status: ${text}`}><Icon size={14} strokeWidth={1.75} aria-hidden="true" />{text}</span>; }

export function Tabs({ tabs, selected, onSelect }: { tabs:{ id:string; label:string }[]; selected:string; onSelect:(id:string)=>void }) { return <div className="v2-tabs" role="tablist">{tabs.map((tab, index) => <button key={tab.id} className="v2-tab" role="tab" aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); onSelect(tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id); } }} onClick={() => onSelect(tab.id)}>{tab.label}</button>)}</div>; }
export function DataTableShell({ title, count, toolbar, children, state }: PropsWithChildren<{ title:string; count?:number; toolbar?:ReactNode; state?:ReactNode }>) { return <SurfaceCard className="v2-table-shell"><div className="v2-table-toolbar"><h3>{title}{count !== undefined ? ` (${count})` : ""}</h3>{toolbar}</div><div className="v2-table-scroll">{state ?? children}</div></SurfaceCard>; }
export function ClickableRow({ children, onOpen }: PropsWithChildren<{ onOpen:()=>void }>) { const canOpen = (target:EventTarget) => !(target instanceof Element && target.closest("button,a,input,select,textarea,[data-row-action]")); return <tr className="v2-clickable-row" tabIndex={0} onClick={(event) => { if (canOpen(event.target)) onOpen(); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && canOpen(event.target)) { event.preventDefault(); onOpen(); } }}>{children}<td aria-hidden="true"><ChevronRight size={16} /></td></tr>; }
export function PreviewList<T>({ items, renderItem, initialCount = 5, viewAll }: { items:T[]; renderItem:(item:T, index:number)=>ReactNode; initialCount?:number; viewAll?:ReactNode }) { const [expanded, setExpanded] = useState(false); const visible = expanded ? items : items.slice(0, initialCount); return <div className="summary-list"><ul>{visible.map(renderItem)}</ul>{items.length > initialCount ? <Button compact variant="secondary" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : `Show more (${items.length - initialCount})`}</Button> : null}{viewAll}</div>; }
export function Pagination({ page, hasPrevious, hasNext, onPrevious, onNext, labels = { page: "Page", previous: "Previous", next: "Next" } }: { page:number; hasPrevious:boolean; hasNext:boolean; onPrevious:()=>void; onNext:()=>void; labels?: { page:string; previous:string; next:string } }) { return <div className="pagination-bar"><span>{labels.page} {page}</span><div><Button compact variant="secondary" disabled={!hasPrevious} onClick={onPrevious}>{labels.previous}</Button><Button compact variant="secondary" disabled={!hasNext} onClick={onNext}>{labels.next}</Button></div></div>; }
export function DetailHeader({ title, summary, action }: { title:string; summary?:string; action?:ReactNode }) { return <PageHeaderV2 title={title} description={summary} action={action} />; }

export function Field({ label, error, help, ...props }: InputHTMLAttributes<HTMLInputElement> & { label:string; error?:string; help?:string }) { const id = useId(); const descriptionId = error || help ? `${id}-description` : undefined; return <div className="v2-field"><label htmlFor={id}>{label}</label><input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={descriptionId} />{error ? <span id={descriptionId} className="v2-field-error" role="alert">{error}</span> : help ? <span id={descriptionId}>{help}</span> : null}</div>; }
export function SelectField({ label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label:string; error?:string; children:ReactNode }) { const id = useId(); return <div className="v2-field"><label htmlFor={id}>{label}</label><select {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>{children}</select>{error ? <span id={`${id}-error`} className="v2-field-error" role="alert">{error}</span> : null}</div>; }
export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Search",
  onSelect,
  selectedLabel,
  onClear,
  clearLabel = "Clear selection",
  loading = false,
  loadingMessage = "Loading...",
  error,
  onRetry,
  noOptionsMessage,
  help,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  onSelect?: (option: ComboboxOption) => void;
  selectedLabel?: string;
  onClear?: () => void;
  clearLabel?: string;
  loading?: boolean;
  loadingMessage?: string;
  error?: string;
  onRetry?: () => void;
  noOptionsMessage?: string;
  help?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const listboxId = `${id}-options`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const hasPopupContent = loading || Boolean(error) || options.length > 0 || Boolean(noOptionsMessage);

  useEffect(() => {
    setActive((current) => (current < 0 ? -1 : Math.min(current, Math.max(0, options.length - 1))));
  }, [options.length]);

  function choose(option: ComboboxOption) {
    if (onSelect) onSelect(option);
    else onChange(option.value);
    setOpen(false);
  }

  function moveActive(delta: number) {
    if (!options.length) return;
    setOpen(true);
    setActive((current) => current < 0 ? (delta > 0 ? 0 : options.length - 1) : (current + delta + options.length) % options.length);
  }

  return (
    <div className="v2-field">
      <label htmlFor={id}>{label}</label>
      {selectedLabel ? (
        <div className="v2-combobox-selected" role="status">
          <span>{selectedLabel}</span>
          {onClear ? <button type="button" className="v2-combobox-clear" aria-label={clearLabel} onClick={onClear} disabled={disabled}><X size={16} aria-hidden="true" /></button> : null}
        </div>
      ) : null}
      <div className="v2-combobox">
        <Search size={18} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open && hasPopupContent}
          aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => { if (!disabled) setOpen(true); }}
          onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); }
            if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); }
            if (event.key === "Enter" && open && options[active]) { event.preventDefault(); choose(options[active]); }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {open && hasPopupContent ? (
          <div id={listboxId} className="v2-combobox-popup" role="listbox" aria-label={label}>
            {loading ? <p role="status">{loadingMessage}</p> : null}
            {error ? <p role="alert">{error}{onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}</p> : null}
            {!loading && !error && options.map((option, index) => (
              <div
                id={`${id}-option-${index}`}
                key={option.value}
                role="option"
                aria-selected={index === active}
                className={index === active ? "active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <strong>{option.label}</strong>
                {option.description ? <span dir="ltr">{option.description}</span> : null}
              </div>
            ))}
            {!loading && !error && !options.length && noOptionsMessage ? <p role="status">{noOptionsMessage}</p> : null}
          </div>
        ) : null}
      </div>
      {help ? <span>{help}</span> : null}
    </div>
  );
}
export function FormSection({ title, children }: PropsWithChildren<{ title:string }>) { return <section className="v2-form-section"><h3>{title}</h3><div className="v2-form-grid">{children}</div></section>; }
export function StickyActionBar({ children }: PropsWithChildren) { return <div className="v2-sticky-actions">{children}</div>; }

type OverlayProps = PropsWithChildren<{ open:boolean; title:string; description?:string; onClose:()=>void; dirty?:boolean; pending?:boolean; wide?:boolean }>;
function Overlay({ open, title, description, onClose, dirty, pending, wide, children, drawer = false }: OverlayProps & { drawer?:boolean }) { const dialog = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLElement | null>(null); const [confirmDiscard, setConfirmDiscard] = useState(false); useEffect(() => { if (!open) { setConfirmDiscard(false); return; } trigger.current = document.activeElement as HTMLElement; const timer = window.setTimeout(() => dialog.current?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus(), 0); const onKey = (event:KeyboardEvent) => { if (event.key === "Escape") requestClose(); if (event.key === "Tab" && dialog.current) { const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")); const last = focusable[focusable.length - 1]; if (!focusable.length) return; if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); focusable[0].focus(); } } }; document.addEventListener("keydown", onKey); return () => { clearTimeout(timer); document.removeEventListener("keydown", onKey); window.setTimeout(() => trigger.current?.focus(), 0); }; }, [open, dirty, pending]); if (!open) return null; function requestClose() { if (pending) return; if (dirty) { setConfirmDiscard(true); return; } onClose(); } return <div className="v2-overlay-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}><div className={`v2-overlay ${drawer ? "drawer" : ""} ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="overlay-title" aria-describedby={description ? "overlay-description" : undefined} ref={dialog}><div className="v2-overlay-header"><div><h2 id="overlay-title">{title}</h2>{description ? <p id="overlay-description">{description}</p> : null}</div><IconButton label="Close" onClick={requestClose} disabled={pending}><X size={20} /></IconButton></div>{children}{confirmDiscard ? <div role="alertdialog" aria-label="Discard changes"><p>Discard unsaved changes?</p><Button variant="danger" onClick={onClose}>Discard</Button><Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</Button></div> : null}</div></div>; }
export function Modal(props:OverlayProps) { return <Overlay {...props} />; } export function Drawer(props:OverlayProps) { return <Overlay {...props} drawer />; } export function ConfirmDialog(props:OverlayProps) { return <Overlay {...props}>{props.children}</Overlay>; }
export function StatePanel({ state, title, description, action }: { state:"loading"|"empty"|"error"|"denied"|"readonly"|"locked"|"notFound"; title:string; description?:string; action?:ReactNode }) { const Icon = state === "error" ? AlertCircle : state === "locked" ? Lock : state === "denied" ? AlertCircle : Info; return <div className="v2-state" role={state === "error" ? "alert" : "status"}><Icon size={24} aria-hidden="true" /><h3>{title}</h3>{description ? <p>{description}</p> : null}{action}</div>; }
export function Skeleton({ height = 20 }: { height?:number }) { return <div className="v2-skeleton" style={{ height }} aria-hidden="true" />; }
