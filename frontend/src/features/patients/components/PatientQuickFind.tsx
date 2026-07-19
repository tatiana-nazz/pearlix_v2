import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { StatePanel, SurfaceCard, SectionHeading } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import { getPatients } from "../../../api/endpoints/patients";
import { useQuery } from "@tanstack/react-query";

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export function PatientQuickFind() {
  const t = useFeatureT(); const [params, setParams] = useSearchParams(); const input = useRef<HTMLInputElement>(null); const surface = useRef<HTMLDivElement>(null);
  const q = params.get("q") ?? ""; const state = params.get("patient_state") === "archived" ? "archived" : "active";
  const [value, setValue] = useState(q); const [debounced, setDebounced] = useState(q); const [open, setOpen] = useState(Boolean(q));
  useEffect(() => setValue(q), [q]);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value.trim()), 300); return () => window.clearTimeout(timer); }, [value]);
  useEffect(() => { if (!debounced) { setOpen(false); return; } const next = new URLSearchParams(params); next.set("q", debounced); next.set("patient_state", state); setParams(next, { replace: true }); setOpen(true); }, [debounced, state]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!surface.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const patients = useQuery({ queryKey: ["patient-quick-find", debounced, state], queryFn: () => getPatients({ page: 1, search: debounced, is_archived: state === "archived" }), enabled: Boolean(debounced) });
  const clear = () => { setValue(""); setDebounced(""); const next = new URLSearchParams(params); next.delete("q"); next.set("patient_state", state); setParams(next, { replace: true }); input.current?.focus(); };
  const setState = (nextState: "active" | "archived") => { const next = new URLSearchParams(params); next.set("patient_state", nextState); if (debounced) next.set("q", debounced); setParams(next, { replace: true }); };
  return <SurfaceCard className="patient-quick-find" major><div className="patient-quick-find-header"><SectionHeading title={t("searchPatients")} description={t("patientQuickFindHelp")} /><select aria-label={t("archiveState")} value={state} onChange={(event) => setState(event.target.value as "active" | "archived")}><option value="active">{t("activePatients")}</option><option value="archived">{t("archivedPatients")}</option></select></div><div className="patient-quick-find-control" ref={surface}><Search size={18} aria-hidden="true" /><input ref={input} role="combobox" aria-autocomplete="list" aria-controls="patient-quick-find-results" aria-expanded={open && Boolean(debounced)} aria-label={t("searchPatients")} placeholder={t("searchPatients")} value={value} onFocus={() => debounced && setOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); input.current?.focus(); } }} onChange={(event) => setValue(event.target.value)} />{value ? <button type="button" className="v2-icon-button" aria-label={t("clearSearch")} onClick={clear}><X size={18} /></button> : null}{open && debounced ? <div id="patient-quick-find-results" className="patient-quick-find-results" role="listbox">{patients.isLoading || patients.isFetching ? <p role="status">{t("searchingPatients")}</p> : patients.isError ? <StatePanel state="error" title={t("patientSearchUnavailable")} action={<button className="v2-button secondary compact" onClick={() => void patients.refetch()}>{t("retry")}</button>} /> : !patients.data?.results.length ? <StatePanel state="empty" title={t("noMatchingPatients")} /> : patients.data.results.slice(0, 10).map((patient) => <Link key={patient.id} role="option" aria-selected={false} className="patient-quick-find-result" to={`/staff/patients/${patient.id}`} onClick={() => setOpen(false)}><span className="patient-quick-find-avatar" aria-hidden="true">{initials(patient.full_name)}</span><span><strong className="bidi-isolate">{patient.full_name}</strong><small className="bidi-isolate">{patient.phone_number}{patient.email ? ` · ${patient.email}` : patient.gender ? ` · ${patient.gender}` : ""}</small></span><span className={`v2-status ${patient.is_archived ? "danger" : "success"}`}>{patient.is_archived ? t("archived") : t("active")}</span></Link>)}</div> : null}</div></SurfaceCard>;
}
