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
import { useFeatureT } from "../../layouts/i18n";
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
  const [editDirty, setEditDirty] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const t = useFeatureT();
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
    return <EmptyState title={t("patientNotFound")} />;
  }

  if (patient.isLoading) return <LoadingState title={t("loadingPatientProfile")} />;
  if (patient.isError) return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} title={t("unableLoadPatientProfile")} />;
  if (!patient.data) return <EmptyState title={t("patientUnavailable")} />;

  function setTab(tab: PatientProfileTab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("edit");
    setSearchParams(next);
  }

  function openEdit() {
    setEditDirty(false);
    const next = new URLSearchParams(searchParams);
    next.set("edit", "1");
    setSearchParams(next);
  }

  function closeEdit() {
    setEditDirty(false);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next);
  }

  async function handleUpdate(values: PatientFormValues) {
    if (!patient.data) return;
    await updatePatient.mutateAsync(updatePayloadFromForm(values, patient.data.version));
    setEditDirty(false); closeEdit();
  }

  async function handleArchiveChange() {
    const currentPatient = patient.data;
    if (!archiveMode || !currentPatient) return;
    if (archiveMode === "archive") await archivePatient.mutateAsync({ id: currentPatient.id, version: currentPatient.version });
    else await unarchivePatient.mutateAsync({ id: currentPatient.id, version: currentPatient.version });
    setArchiveMode(null);
  }

  async function handleReloadLatestPatient() {
    await patient.refetch();
    updatePatient.reset();
    setEditDirty(false);
    setReloadConfirm(false);
  }

  const archiveError = archiveMode === "archive" ? archivePatient.error : unarchivePatient.error;
  const isArchiveSubmitting = archivePatient.isPending || unarchivePatient.isPending;

  return (
    <div className="patient-page">
      <Link className="inline-back-link" to={patientListPath(role)}>
        {t("backToPatients")}
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

      <Modal open={isEditing && permissions.canEdit} title={t("editPatient")} onClose={closeEdit} pending={updatePatient.isPending} dirty={editDirty} wide>
        {permissions.canEdit ? (
            <PatientForm
              mode="edit"
              role={role}
              patient={patient.data}
              submitLabel={t("saveChanges")}
              isSubmitting={updatePatient.isPending}
              error={updatePatient.error}
              onSubmit={handleUpdate}
              onDirtyChange={setEditDirty}
              onReloadLatest={() => setReloadConfirm(true)}
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
          <EmptyState title={t("billingUnavailableDoctor")} />
        </Card>
      ) : null}

      <ConfirmDialog open={Boolean(archiveMode)} title={archiveMode === "archive" ? t("archivePatient") : t("unarchivePatient")} description={archiveMode === "archive" ? t("archivePatientHelp") : t("unarchivePatientPrompt")} onClose={() => setArchiveMode(null)} pending={isArchiveSubmitting}><button className={archiveMode === "archive" ? "v2-button danger" : "v2-button"} type="button" onClick={() => void handleArchiveChange()} disabled={isArchiveSubmitting}>{archiveMode === "archive" ? t("archivePatient") : t("unarchivePatient")}</button>{archiveError ? <ErrorState error={archiveError} title={t("unableArchive")} /> : null}</ConfirmDialog>
      <ConfirmDialog open={reloadConfirm} title={t("reloadLatest")} description={t("reloadPatientPrompt")} onClose={() => setReloadConfirm(false)}><button className="v2-button secondary" type="button" onClick={() => setReloadConfirm(false)}>{t("continueReviewing")}</button><button className="v2-button danger" type="button" onClick={() => void handleReloadLatestPatient()}>{t("reloadLatest")}</button></ConfirmDialog>
    </div>
  );
}
