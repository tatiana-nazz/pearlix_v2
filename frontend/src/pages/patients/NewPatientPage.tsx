import { useEffect, useRef, useState } from "react";
import { Navigate, useBlocker, useNavigate } from "react-router-dom";

import { Button, ConfirmDialog, PageHeaderV2, SurfaceCard } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import { PatientForm, createPayloadFromForm } from "../../features/patients/components/PatientForm";
import { useCreatePatient } from "../../features/patients/hooks/usePatientMutations";
import type { PatientFormValues } from "../../features/patients/utils/patientFormMapping";
import { patientListPath, patientProfilePath } from "../../features/patients/utils/patientPermissions";
import type { UserRole } from "../../types/auth";

interface NewPatientPageProps {
  role: UserRole;
}

export function NewPatientPage({ role }: NewPatientPageProps) {
  const t = useFeatureT();
  const navigate = useNavigate();
  const createPatient = useCreatePatient();
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const approvedNavigation = useRef(false);
  const navigatedAfterCreate = useRef(false);
  pendingRef.current = createPatient.isPending;
  const blocker = useBlocker(() => !approvedNavigation.current && (dirtyRef.current || pendingRef.current));

  function setFormDirty(next: boolean) {
    dirtyRef.current = next;
    setDirty(next);
  }

  async function handleSubmit(values: PatientFormValues) {
    const patient = await createPatient.mutateAsync(createPayloadFromForm(values));
    if (navigatedAfterCreate.current) return;
    navigatedAfterCreate.current = true;
    approvedNavigation.current = true;
    dirtyRef.current = false;
    pendingRef.current = false;
    setDirty(false);
    setConfirmLeave(false);
    navigate(patientProfilePath(role, patient.id));
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || createPatient.isPending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [createPatient.isPending, dirty]);

  useEffect(() => {
    if (blocker.state === "blocked") setConfirmLeave(true);
  }, [blocker.state]);

  if (role !== "STAFF") return <Navigate to="/access-denied" replace />;

  function keepEditing() {
    if (blocker.state === "blocked") blocker.reset();
    setConfirmLeave(false);
  }

  function discardChanges() {
    if (createPatient.isPending || blocker.state !== "blocked") return;
    dirtyRef.current = false;
    setDirty(false);
    setConfirmLeave(false);
    blocker.proceed();
  }

  return <div className="patient-page narrow">
    <PageHeaderV2 title={t("addPatient")} description={t("createPatientDescription")} />
    <SurfaceCard major>
      <PatientForm mode="create" role={role} submitLabel={t("createPatient")} isSubmitting={createPatient.isPending} error={createPatient.error} onSubmit={handleSubmit} onDirtyChange={setFormDirty} onCancel={() => navigate(patientListPath(role))} />
    </SurfaceCard>
    <ConfirmDialog open={confirmLeave} title={t("discardChanges")} description={t("discardChanges")} onClose={keepEditing} pending={createPatient.isPending}>
      <Button type="button" variant="secondary" onClick={keepEditing} disabled={createPatient.isPending}>{t("keepEditing")}</Button>
      <Button type="button" variant="danger" onClick={discardChanges} disabled={createPatient.isPending || blocker.state !== "blocked"}>{t("discard")}</Button>
    </ConfirmDialog>
  </div>;
}
