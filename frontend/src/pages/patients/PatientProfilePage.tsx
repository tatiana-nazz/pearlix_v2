import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { ArchivePatientDialog } from "../../features/patients/components/ArchivePatientDialog";
import { PatientAppointmentsSummary } from "../../features/patients/components/PatientAppointmentsSummary";
import { PatientBillingSummary } from "../../features/patients/components/PatientBillingSummary";
import { PatientForm, updatePayloadFromForm } from "../../features/patients/components/PatientForm";
import { PatientMedicalSummary } from "../../features/patients/components/PatientMedicalSummary";
import { PatientOverview } from "../../features/patients/components/PatientOverview";
import { PatientProfileHeader } from "../../features/patients/components/PatientProfileHeader";
import { PatientProfileTab, PatientProfileTabs } from "../../features/patients/components/PatientProfileTabs";
import { PatientVisitsSummary } from "../../features/patients/components/PatientVisitsSummary";
import { PatientXraySummary } from "../../features/patients/components/PatientXraySummary";
import { patientCopy } from "../../features/patients/i18n";
import {
  usePatient,
  usePatientAiResults,
  usePatientAppointments,
  usePatientVisits,
  usePatientXrays,
} from "../../features/patients/hooks/usePatient";
import { useArchivePatient, useUnarchivePatient, useUpdatePatient } from "../../features/patients/hooks/usePatientMutations";
import { getPatientPermissions, patientListPath } from "../../features/patients/utils/patientPermissions";
import type { PatientFormValues } from "../../features/patients/utils/patientFormMapping";
import type { UserRole } from "../../types/auth";
import { useAuthStore } from "../../auth/authStore";

interface PatientProfilePageProps {
  role: UserRole;
  defaultTab?: PatientProfileTab;
}

const tabValues: PatientProfileTab[] = ["overview", "medical", "visits", "appointments", "xrays", "billing"];

function tabFromSearch(value: string | null): PatientProfileTab {
  return tabValues.includes(value as PatientProfileTab) ? (value as PatientProfileTab) : "overview";
}

export function PatientProfilePage({ role, defaultTab = "overview" }: PatientProfilePageProps) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = Number(params.patientId);
  const [isEditing, setIsEditing] = useState(Boolean(searchParams.get("edit")));
  const [archiveMode, setArchiveMode] = useState<"archive" | "unarchive" | null>(null);
  const activeTab = searchParams.get("tab") ? tabFromSearch(searchParams.get("tab")) : defaultTab;
  const patient = usePatient(patientId);
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
  const updatePatient = useUpdatePatient(patientId);
  const archivePatient = useArchivePatient();
  const unarchivePatient = useUnarchivePatient();
  const tabQueriesEnabled = Boolean(patient.data);
  const visits = usePatientVisits(patientId, tabQueriesEnabled && activeTab === "visits");
  const appointments = usePatientAppointments(patientId, tabQueriesEnabled && activeTab === "appointments");
  const xrays = usePatientXrays(patientId, tabQueriesEnabled && activeTab === "xrays");
  const aiResults = usePatientAiResults(patientId, tabQueriesEnabled && activeTab === "xrays");

  useEffect(() => {
    setIsEditing(searchParams.get("edit") === "1");
  }, [searchParams]);

  const permissions = useMemo(() => getPatientPermissions(role, patient.data), [role, patient.data]);
  const visibleTab = activeTab === "billing" && !permissions.canViewBillingTab ? "overview" : activeTab;

  if (!Number.isFinite(patientId)) {
    return <EmptyState title={c.invalidPatient} />;
  }

  if (patient.isLoading) return <LoadingState title={c.loadingProfile} />;
  if (patient.isError) return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} title={c.loadProfileError} />;
  if (!patient.data) return <EmptyState title={c.missingPatient} />;

  function setTab(tab: PatientProfileTab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("edit");
    setSearchParams(next);
  }

  function openEdit(section: "general" | "medical" = "general") {
    const next = new URLSearchParams(searchParams);
    next.set("edit", section);
    setSearchParams(next);
  }

  function closeEdit() {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next);
  }

  async function handleUpdate(values: PatientFormValues) {
    if (!patient.data) return;
    await updatePatient.mutateAsync(updatePayloadFromForm(values, patient.data.version));
    closeEdit();
  }

  async function handleArchiveChange() {
    const currentPatient = patient.data;
    if (!archiveMode || !currentPatient) return;
    if (archiveMode === "archive") await archivePatient.mutateAsync({ id: currentPatient.id, version: currentPatient.version });
    else await unarchivePatient.mutateAsync({ id: currentPatient.id, version: currentPatient.version });
    setArchiveMode(null);
  }

  async function handleReloadLatestPatient() {
    if (window.confirm(c.reloadPatientConfirm)) {
      await patient.refetch();
      updatePatient.reset();
    }
  }

  const archiveError = archiveMode === "archive" ? archivePatient.error : unarchivePatient.error;
  const isArchiveSubmitting = archivePatient.isPending || unarchivePatient.isPending;

  return (
    <div className="patient-page">
      <Link className="inline-back-link" to={patientListPath(role)}>
        {c.backToPatients}
      </Link>
      <PatientProfileHeader
        role={role}
        patient={patient.data}
        onEdit={() => openEdit("general")}
        onArchive={() => {
          archivePatient.reset();
          setArchiveMode("archive");
        }}
        onUnarchive={() => {
          unarchivePatient.reset();
          setArchiveMode("unarchive");
        }}
      />

      {isEditing && permissions.canEdit ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog-panel wide" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
            <h3 id="edit-patient-title">{searchParams.get("edit") === "medical" ? c.medicalHistory : c.editPatient}</h3>
            <PatientForm
              mode="edit"
              section={searchParams.get("edit") === "medical" ? "medical" : "general"}
              role={role}
              patient={patient.data}
              submitLabel={c.saveChanges}
              isSubmitting={updatePatient.isPending}
              error={updatePatient.error}
              onSubmit={handleUpdate}
              onCancel={closeEdit}
              onReloadLatest={() => void handleReloadLatestPatient()}
              onContinueReviewing={() => updatePatient.reset()}
            />
          </section>
        </div>
      ) : null}

      <PatientProfileTabs role={role} activeTab={visibleTab} onTabChange={setTab} />

      <div id={`patient-profile-panel-${visibleTab}`} role="tabpanel" aria-labelledby={`patient-profile-tab-${visibleTab}`} tabIndex={0}>
      {visibleTab === "overview" ? <PatientOverview patient={patient.data} /> : null}
      {visibleTab === "medical" ? <PatientMedicalSummary role={role} patient={patient.data} onEdit={() => openEdit("medical")} /> : null}
      {visibleTab === "visits" ? (
        <PatientVisitsSummary role={role} visits={visits.data} isLoading={visits.isLoading} error={visits.error} onRetry={() => void visits.refetch()} />
      ) : null}
      {visibleTab === "appointments" ? (
        <PatientAppointmentsSummary
          role={role}
          appointments={appointments.data}
          isLoading={appointments.isLoading}
          error={appointments.error}
          onRetry={() => void appointments.refetch()}
        />
      ) : null}
      {visibleTab === "xrays" ? (
        <PatientXraySummary
          role={role}
          patientId={patientId}
          xrays={xrays.data}
          aiResults={aiResults.data}
          isLoading={xrays.isLoading || aiResults.isLoading}
          error={xrays.error ?? aiResults.error}
          onRetry={() => {
            void xrays.refetch();
            void aiResults.refetch();
          }}
        />
      ) : null}
      {visibleTab === "billing" ? <PatientBillingSummary role={role} patientId={patientId} /> : null}
      </div>

      <ArchivePatientDialog
        patient={archiveMode ? patient.data : null}
        mode={archiveMode ?? "archive"}
        isSubmitting={isArchiveSubmitting}
        error={archiveError}
        onCancel={() => setArchiveMode(null)}
        onConfirm={() => void handleArchiveChange()}
      />
    </div>
  );
}
