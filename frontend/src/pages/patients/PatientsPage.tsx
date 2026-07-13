import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { ConfirmDialog } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import { ArchiveFilter, DoctorWorkflowFilter, PatientFilters } from "../../features/patients/components/PatientFilters";
import { PatientTable } from "../../features/patients/components/PatientTable";
import { useArchivePatient, useUnarchivePatient } from "../../features/patients/hooks/usePatientMutations";
import { usePatients } from "../../features/patients/hooks/usePatients";
import { getPatientPermissions, newPatientPath } from "../../features/patients/utils/patientPermissions";
import type { UserRole } from "../../types/auth";
import type { PatientListFilters, PatientListItem } from "../../types/patients";

interface PatientsPageProps {
  role: UserRole;
}

function paramsToFilters(role: UserRole, searchParams: URLSearchParams, debouncedSearch: string): PatientListFilters {
  const page = Number(searchParams.get("page") || "1");
  const filters: PatientListFilters = { page: Number.isFinite(page) && page > 0 ? page : 1 };
  if (debouncedSearch) filters.search = debouncedSearch;
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
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [dialogPatient, setDialogPatient] = useState<PatientListItem | null>(null);
  const [dialogMode, setDialogMode] = useState<"archive" | "unarchive">("archive");
  const permissions = getPatientPermissions(role);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (debouncedSearch !== current) {
      const next = new URLSearchParams(searchParams);
      if (debouncedSearch) next.set("search", debouncedSearch);
      else next.delete("search");
      next.set("page", "1");
      setSearchParams(next, { replace: true });
    }
  }, [debouncedSearch, searchParams, setSearchParams]);

  const archiveFilter = (searchParams.get("archive") === "archived" ? "archived" : "active") as ArchiveFilter;
  const doctorFilter = (searchParams.get("scope") ?? "all") as DoctorWorkflowFilter;
  const filters = useMemo(() => paramsToFilters(role, searchParams, debouncedSearch), [role, searchParams, debouncedSearch]);
  const patients = usePatients(filters);
  const archive = useArchivePatient();
  const unarchive = useUnarchivePatient();

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  function setArchiveFilter(value: ArchiveFilter) {
    const next = new URLSearchParams(searchParams);
    next.set("archive", value);
    next.set("page", "1");
    setSearchParams(next);
  }

  function setDoctorFilter(value: DoctorWorkflowFilter) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("scope");
    else next.set("scope", value);
    next.set("page", "1");
    setSearchParams(next);
  }

  function openArchiveDialog(patient: PatientListItem) {
    setDialogPatient(patient);
    setDialogMode("archive");
    archive.reset();
  }

  function openUnarchiveDialog(patient: PatientListItem) {
    setDialogPatient(patient);
    setDialogMode("unarchive");
    unarchive.reset();
  }

  async function confirmArchiveChange() {
    if (!dialogPatient) return;
    if (dialogMode === "archive") await archive.mutateAsync({ id: dialogPatient.id, version: dialogPatient.version });
    else await unarchive.mutateAsync({ id: dialogPatient.id, version: dialogPatient.version });
    setDialogPatient(null);
  }

  const currentPage = filters.page ?? 1;
  const isMutating = archive.isPending || unarchive.isPending;
  const dialogError = dialogMode === "archive" ? archive.error : unarchive.error;
  const workspace = role === "STAFF" ? t("staffWorkspace") : role === "DOCTOR" ? t("doctorWorkspace") : t("adminWorkspace");
  const description = role === "STAFF" ? t("patientWorkspaceStaff") : role === "DOCTOR" ? t("patientWorkspaceDoctor") : t("patientWorkspaceAdmin");

  return (
    <div className="patient-page">
      <PageHeader
        eyebrow={workspace}
        title={t("patients")}
        description={description}
        actions={
          permissions.canCreate ? (
            <Link className="button primary" to={newPatientPath(role)}>
              {t("addPatient")}
            </Link>
          ) : null
        }
      />

      <Card>
        <PatientFilters
          role={role}
          search={search}
          archiveFilter={archiveFilter}
          doctorFilter={doctorFilter}
          onSearchChange={setSearch}
          onArchiveFilterChange={setArchiveFilter}
          onDoctorFilterChange={setDoctorFilter}
        />
      </Card>

      <Card>
        {patients.isLoading ? <LoadingState title={t("loadingPatients")} /> : null}
        {patients.isError ? <ErrorState error={patients.error} onRetry={() => void patients.refetch()} title={t("unableToLoadPatients")} /> : null}
        {patients.data ? (
          <>
            {patients.isFetching ? <p className="panel-note">{t("refreshingPatients")}</p> : null}
            <PatientTable
              role={role}
              patients={patients.data.results}
              showArchivedStatus={role !== "DOCTOR"}
              onArchive={openArchiveDialog}
              onUnarchive={openUnarchiveDialog}
            />
            <div className="pagination-bar">
              <span className="bidi-isolate">{patients.data.count} {t("records")}</span>
              <div>
                <button className="button secondary" type="button" disabled={!patients.data.previous || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  {t("previous")}
                </button>
                <span className="bidi-isolate">{t("page")} {currentPage}</span>
                <button className="button secondary" type="button" disabled={!patients.data.next} onClick={() => setPage(currentPage + 1)}>
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <ConfirmDialog open={Boolean(dialogPatient)} title={dialogMode === "archive" ? t("archivePatient") : t("unarchivePatient")} description={dialogPatient ? `${dialogMode === "archive" ? t("archivePatientPrompt") : t("unarchivePatientPrompt")} ${dialogPatient.full_name}` : undefined} onClose={() => setDialogPatient(null)} pending={isMutating}><button className={dialogMode === "archive" ? "v2-button danger" : "v2-button"} type="button" disabled={isMutating} onClick={() => void confirmArchiveChange()}>{dialogMode === "archive" ? t("archivePatient") : t("unarchivePatient")}</button>{dialogError ? <ErrorState error={dialogError} title={t("unableArchive")} /> : null}</ConfirmDialog>
    </div>
  );
}
