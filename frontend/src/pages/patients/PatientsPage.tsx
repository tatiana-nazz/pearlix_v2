import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { DataTableShell, StatePanel } from "../../components/v2";
import { ArchiveFilter, DoctorWorkflowFilter, PatientFilters } from "../../features/patients/components/PatientFilters";
import { PatientTable } from "../../features/patients/components/PatientTable";
import { usePatients } from "../../features/patients/hooks/usePatients";
import { getPatientPermissions, newPatientPath } from "../../features/patients/utils/patientPermissions";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";
import type { PatientListFilters } from "../../types/patients";

interface PatientsPageProps { role: UserRole; }

function paramsToFilters(role: UserRole, searchParams: URLSearchParams): PatientListFilters {
  const page = Number(searchParams.get("page") || "1");
  const filters: PatientListFilters = { page: Number.isFinite(page) && page > 0 ? page : 1 };
  const search = searchParams.get("search")?.trim();
  if (search) filters.search = search;
  if (role !== "DOCTOR") filters.is_archived = searchParams.get("archive") === "archived";
  if (role === "DOCTOR") {
    const scope = searchParams.get("scope");
    filters.my_patients = scope === "my_patients" || undefined;
    filters.upcoming_with_me = scope === "upcoming_with_me" || undefined;
    filters.last_visit_with_me = scope === "last_visit_with_me" || undefined;
  }
  return filters;
}

export function PatientsPage({ role }: PatientsPageProps) {
  const t = useFeatureT();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const pendingSearch = useRef(false);
  const permissions = getPatientPermissions(role);

  useEffect(() => {
    if (!pendingSearch.current && (urlSearch !== search || urlSearch !== debouncedSearch)) {
      pendingSearch.current = false;
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
    }
  }, [debouncedSearch, search, urlSearch]);

  useEffect(() => {
    if (!pendingSearch.current) return;
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!pendingSearch.current || debouncedSearch === urlSearch) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("search", debouncedSearch);
    else next.delete("search");
    next.set("page", "1");
    pendingSearch.current = false;
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams, urlSearch]);

  const archiveFilter = (searchParams.get("archive") === "archived" ? "archived" : "active") as ArchiveFilter;
  const doctorFilter = (searchParams.get("scope") ?? "all") as DoctorWorkflowFilter;
  const filters = useMemo(() => paramsToFilters(role, searchParams), [role, searchParams]);
  const patients = usePatients(filters);
  const currentPage = filters.page ?? 1;
  const hasActiveFilters = Boolean(urlSearch || (role !== "DOCTOR" && archiveFilter === "archived") || (role === "DOCTOR" && doctorFilter !== "all"));
  const workspace = role === "STAFF" ? t("staffWorkspace") : role === "DOCTOR" ? t("doctorWorkspace") : t("adminWorkspace");
  const description = role === "STAFF" ? t("patientWorkspaceStaff") : role === "DOCTOR" ? t("patientWorkspaceDoctor") : t("patientWorkspaceAdmin");

  function updateParams(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    setSearchParams(next);
  }

  function setPage(page: number) { updateParams((next) => next.set("page", String(page))); }
  function setArchiveFilter(value: ArchiveFilter) { updateParams((next) => { if (value === "archived") next.set("archive", value); else next.delete("archive"); next.set("page", "1"); }); }
  function setDoctorFilter(value: DoctorWorkflowFilter) { updateParams((next) => { if (value === "all") next.delete("scope"); else next.set("scope", value); next.set("page", "1"); }); }
  function clearFilters() { pendingSearch.current = false; setSearch(""); setDebouncedSearch(""); updateParams((next) => { next.delete("search"); next.delete("archive"); next.delete("scope"); next.set("page", "1"); }); }

  return <div className="patient-page patient-directory-page">
    <PageHeader eyebrow={workspace} title={t("patients")} description={description} actions={permissions.canCreate ? <Link className="button primary" to={newPatientPath(role)}>{t("addPatient")}</Link> : null} />
    <Card className="patient-filter-card"><PatientFilters role={role} search={search} archiveFilter={archiveFilter} doctorFilter={doctorFilter} hasActiveFilters={hasActiveFilters} onSearchChange={(value) => { pendingSearch.current = true; setSearch(value); }} onArchiveFilterChange={setArchiveFilter} onDoctorFilterChange={setDoctorFilter} onClear={clearFilters} /></Card>
    {patients.isLoading && !patients.data ? <LoadingState title={t("loadingPatients")} /> : null}
    {patients.isError && !patients.data ? <ErrorState error={patients.error} onRetry={() => void patients.refetch()} title={t("unableToLoadPatients")} /> : null}
    {patients.data ? <DataTableShell title={t("allPatients")} count={patients.data.count} state={!patients.data.results.length ? <StatePanel state="empty" title={hasActiveFilters ? t("patientNoMatching") : t("patientNoRecords")} /> : undefined}>
      {patients.data.results.length ? <PatientTable role={role} patients={patients.data.results} /> : null}
    </DataTableShell> : null}
    {patients.isFetching && patients.data ? <p className="panel-note" role="status">{t("refreshingPatients")}</p> : null}
    {patients.data ? <div className="pagination-bar"><span className="bidi-isolate">{patients.data.count} {t("records")}</span><div><button className="button secondary" type="button" disabled={!patients.data.previous || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t("previous")}</button><span className="bidi-isolate">{t("page")} {currentPage}</span><button className="button secondary" type="button" disabled={!patients.data.next} onClick={() => setPage(currentPage + 1)}>{t("next")}</button></div></div> : null}
  </div>;
}
