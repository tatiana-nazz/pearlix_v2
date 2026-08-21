import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { BackLink } from "../../components/BackLink";
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
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";

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
  const [editDirty, setEditDirty] = useState(false);
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

  const permissions = useMemo(() => getPatientPermissions(role, patient.data), [role, patient.data]);
  const visibleTab = activeTab === "billing" && !permissions.canViewBillingTab ? "overview" : activeTab;
  const requestedEdit = searchParams.get("edit");
  const editSection = requestedEdit === "medical" ? "medical" : requestedEdit === "general" || requestedEdit === "1" ? "general" : null;
  const isEditing = Boolean(
    permissions.canEdit
    && editSection
    && ((visibleTab === "overview" && editSection === "general") || (visibleTab === "medical" && editSection === "medical")),
  );
  useUnsavedChanges(isEditing && editDirty, c.discardChanges);

  useEffect(() => {
    if (!patient.data) return;
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (activeTab === "billing" && !permissions.canViewBillingTab) {
      next.set("tab", "overview");
      next.delete("edit");
      changed = true;
    } else if (requestedEdit) {
      const normalizedEdit = requestedEdit === "1" ? "general" : requestedEdit;
      const validCombination = permissions.canEdit
        && ((visibleTab === "overview" && normalizedEdit === "general") || (visibleTab === "medical" && normalizedEdit === "medical"));
      if (!validCombination) {
        next.delete("edit");
        changed = true;
      } else if (requestedEdit !== normalizedEdit) {
        next.set("edit", normalizedEdit);
        changed = true;
      }
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [activeTab, patient.data, permissions.canEdit, permissions.canViewBillingTab, requestedEdit, searchParams, setSearchParams, visibleTab]);

  if (!Number.isFinite(patientId)) {
    return <EmptyState title={c.invalidPatient} />;
  }

  if (patient.isLoading) return <LoadingState title={c.loadingProfile} />;
  if (patient.isError) return <ErrorState error={patient.error} onRetry={() => void patient.refetch()} title={c.loadProfileError} />;
  if (!patient.data) return <EmptyState title={c.missingPatient} />;

  function setTab(tab: PatientProfileTab) {
    if (isEditing && editDirty && !window.confirm(c.discardChanges)) return;
    setEditDirty(false);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("edit");
    setSearchParams(next);
  }

  function openEdit(section: "general" | "medical" = "general") {
    setEditDirty(false);
    const next = new URLSearchParams(searchParams);
    next.set("tab", section === "medical" ? "medical" : "overview");
    next.set("edit", section);
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
    await updatePatient.mutateAsync(updatePayloadFromForm(values, patient.data.version, editSection ?? "general"));
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
      <BackLink
        to={patientListPath(role)}
        onClick={(event) => {
          if (isEditing && editDirty && !window.confirm(c.discardChanges)) event.preventDefault();
        }}
      >
        {c.backToPatients}
      </BackLink>
      <div className={`patient-detail-surface${isEditing ? " is-editing" : ""}`}>
        {!isEditing ? <aside className="patient-identity-rail" aria-label={patient.data.full_name}>
          <span className="profile-initials" aria-hidden="true">
            {patient.data.first_name.slice(0, 1).toUpperCase()}{patient.data.last_name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2>{patient.data.full_name}</h2>
            <p>{c.patientProfile}</p>
          </div>
          <dl className="identity-details">
            <div><dt>{c.gender}</dt><dd>{patient.data.gender === "Female" ? c.female : c.male}</dd></div>
            <div><dt>{c.age}</dt><dd>{patient.data.age !== null ? `${patient.data.age} ${c.yearsOld}` : c.ageNotRecorded}</dd></div>
            <div><dt>{c.phone}</dt><dd dir="ltr">{patient.data.phone_number || c.notRecorded}</dd></div>
            <div><dt>{c.email}</dt><dd dir="ltr">{patient.data.email || c.notRecorded}</dd></div>
            <div><dt>{c.bloodGroup}</dt><dd>{patient.data.blood_group || c.notRecorded}</dd></div>
            <div><dt>{c.emergencyContact}</dt><dd>{patient.data.emergency_contact || c.notRecorded}</dd></div>
          </dl>
        </aside> : null}

        <section className="patient-detail-main">
          <PatientProfileHeader
            role={role}
            patient={patient.data}
            onEdit={() => openEdit(visibleTab === "medical" ? "medical" : "general")}
            showEdit={!isEditing && (visibleTab === "overview" || visibleTab === "medical")}
            onArchive={() => {
              archivePatient.reset();
              setArchiveMode("archive");
            }}
            onUnarchive={() => {
              unarchivePatient.reset();
              setArchiveMode("unarchive");
            }}
          />

          <PatientProfileTabs role={role} activeTab={visibleTab} onTabChange={setTab} />

          <div id={`patient-profile-panel-${visibleTab}`} role="tabpanel" aria-labelledby={`patient-profile-tab-${visibleTab}`} tabIndex={0}>
            {isEditing && editSection ? <section className="patient-inline-edit" aria-labelledby="patient-inline-edit-title">
              <header>
                <p className="eyebrow">{c.patientProfile}</p>
                <h3 id="patient-inline-edit-title">{editSection === "medical" ? c.medicalHistory : c.editPatient}</h3>
              </header>
              <PatientForm
                mode="edit"
                section={editSection}
                role={role}
                patient={patient.data}
                submitLabel={c.saveChanges}
                isSubmitting={updatePatient.isPending}
                error={updatePatient.error}
                onSubmit={handleUpdate}
                onCancel={closeEdit}
                onReloadLatest={() => void handleReloadLatestPatient()}
                onContinueReviewing={() => updatePatient.reset()}
                onDirtyChange={setEditDirty}
              />
            </section> : null}
            {!isEditing && visibleTab === "overview" ? <PatientOverview patient={patient.data} /> : null}
            {!isEditing && visibleTab === "medical" ? <PatientMedicalSummary role={role} patient={patient.data} /> : null}
            {!isEditing && visibleTab === "visits" ? (
              <PatientVisitsSummary role={role} visits={visits.data} isLoading={visits.isLoading} error={visits.error} onRetry={() => void visits.refetch()} />
            ) : null}
            {!isEditing && visibleTab === "appointments" ? (
              <PatientAppointmentsSummary
                role={role}
                appointments={appointments.data}
                isLoading={appointments.isLoading}
                error={appointments.error}
                onRetry={() => void appointments.refetch()}
              />
            ) : null}
            {!isEditing && visibleTab === "xrays" ? (
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
            {!isEditing && visibleTab === "billing" ? <PatientBillingSummary role={role} patientId={patientId} /> : null}
          </div>
        </section>
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
