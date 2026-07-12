import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { ConfirmDialog, Modal } from "../../components/v2";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PatientAppointmentsSummary } from "../../features/patients/components/PatientAppointmentsSummary";
import { PatientBillingSummary } from "../../features/patients/components/PatientBillingSummary";
import { PatientForm, updatePayloadFromForm } from "../../features/patients/components/PatientForm";
import { PatientMedicalSummary } from "../../features/patients/components/PatientMedicalSummary";
import { PatientOverview } from "../../features/patients/components/PatientOverview";
import { PatientProfileHeader } from "../../features/patients/components/PatientProfileHeader";
import { PatientProfileTab, PatientProfileTabs } from "../../features/patients/components/PatientProfileTabs";
import { PatientVisitsSummary } from "../../features/patients/components/PatientVisitsSummary";
import { PatientXraySummary } from "../../features/patients/components/PatientXraySummary";
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
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [archiveMode, setArchiveMode] = useState<"archive" | "unarchive" | null>(null);
  const activeTab = searchParams.get("tab") ? tabFromSearch(searchParams.get("tab")) : defaultTab;
  const patient = usePatient(patientId);
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

  if (!Number.isFinite(patientId)) {
    return <EmptyState title="Patient was not found." />;
  }

  if (patient.isLoading) return <LoadingState title="Loading patient profile..." />;
  if (patient.isError) return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} title="Unable to load patient profile" />;
  if (!patient.data) return <EmptyState title="Patient was not found or is unavailable to this role." />;

  function setTab(tab: PatientProfileTab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("edit");
    setSearchParams(next);
  }

  function openEdit() {
    const next = new URLSearchParams(searchParams);
    next.set("edit", "1");
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
    if (window.confirm("Reload the latest patient record and discard unsaved edits?")) {
      await patient.refetch();
      updatePatient.reset();
    }
  }

  const archiveError = archiveMode === "archive" ? archivePatient.error : unarchivePatient.error;
  const isArchiveSubmitting = archivePatient.isPending || unarchivePatient.isPending;

  return (
    <div className="patient-page">
      <Link className="inline-back-link" to={patientListPath(role)}>
        Back to patients
      </Link>
      <PatientProfileHeader
        role={role}
        patient={patient.data}
        onEdit={openEdit}
        onArchive={() => {
          archivePatient.reset();
          setArchiveMode("archive");
        }}
        onUnarchive={() => {
          unarchivePatient.reset();
          setArchiveMode("unarchive");
        }}
      />

      <Modal open={isEditing && permissions.canEdit} title="Edit Patient" onClose={closeEdit} pending={updatePatient.isPending} dirty>
        {permissions.canEdit ? (
            <PatientForm
              mode="edit"
              role={role}
              patient={patient.data}
              submitLabel="Save changes"
              isSubmitting={updatePatient.isPending}
              error={updatePatient.error}
              onSubmit={handleUpdate}
              onCancel={closeEdit}
              onReloadLatest={() => void handleReloadLatestPatient()}
              onContinueReviewing={() => updatePatient.reset()}
            />
        ) : null}
      </Modal>

      <PatientProfileTabs role={role} activeTab={activeTab === "billing" && !permissions.canViewBillingTab ? "overview" : activeTab} onTabChange={setTab} />

      {activeTab === "overview" ? <PatientOverview patient={patient.data} /> : null}
      {activeTab === "medical" ? <PatientMedicalSummary role={role} patient={patient.data} onEdit={openEdit} /> : null}
      {activeTab === "visits" ? (
        <PatientVisitsSummary role={role} visits={visits.data} isLoading={visits.isLoading} error={visits.error} onRetry={() => void visits.refetch()} />
      ) : null}
      {activeTab === "appointments" ? (
        <PatientAppointmentsSummary
          role={role}
          appointments={appointments.data}
          isLoading={appointments.isLoading}
          error={appointments.error}
          onRetry={() => void appointments.refetch()}
        />
      ) : null}
      {activeTab === "xrays" ? (
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
      {activeTab === "billing" && permissions.canViewBillingTab ? <PatientBillingSummary role={role} patientId={patientId} /> : null}
      {activeTab === "billing" && !permissions.canViewBillingTab ? (
        <Card>
          <EmptyState title="Billing and invoices are not available in the Doctor workspace." />
        </Card>
      ) : null}

      <ConfirmDialog open={Boolean(archiveMode)} title={archiveMode === "archive" ? "Archive patient" : "Unarchive patient"} description={archiveMode === "archive" ? "Archived records are retained and can be restored." : "Restore this patient to active records."} onClose={() => setArchiveMode(null)} pending={isArchiveSubmitting}><button className={archiveMode === "archive" ? "v2-button danger" : "v2-button"} type="button" onClick={() => void handleArchiveChange()} disabled={isArchiveSubmitting}>{archiveMode === "archive" ? "Archive patient" : "Unarchive patient"}</button>{archiveError ? <ErrorState error={archiveError} title="Unable to update patient archive state" /> : null}</ConfirmDialog>
    </div>
  );
}
