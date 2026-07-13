import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { ConfirmDialog, PageHeaderV2, SurfaceCard } from "../../components/v2";
import { PatientForm, createPayloadFromForm } from "../../features/patients/components/PatientForm";
import { useCreatePatient } from "../../features/patients/hooks/usePatientMutations";
import { patientListPath, patientProfilePath } from "../../features/patients/utils/patientPermissions";
import type { UserRole } from "../../types/auth";
import type { PatientFormValues } from "../../features/patients/utils/patientFormMapping";
import { useFeatureT } from "../../layouts/i18n";

interface NewPatientPageProps {
  role: UserRole;
}

export function NewPatientPage({ role }: NewPatientPageProps) {
  const t = useFeatureT();
  const navigate = useNavigate();
  const createPatient = useCreatePatient();
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (role !== "STAFF") return <Navigate to="/access-denied" replace />;

  async function handleSubmit(values: PatientFormValues) {
    const patient = await createPatient.mutateAsync(createPayloadFromForm(values));
    setDirty(false);
    navigate(patientProfilePath(role, patient.id));
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => { if (dirty && !createPatient.isPending) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [createPatient.isPending, dirty]);

  return (
    <div className="patient-page narrow">
      <PageHeaderV2 title={t("addPatient")} description={t("createPatientDescription")} />
      <SurfaceCard major>
        <PatientForm
          mode="create"
          role={role}
          submitLabel={t("createPatient")}
          isSubmitting={createPatient.isPending}
          error={createPatient.error}
          onSubmit={handleSubmit}
          onDirtyChange={setDirty}
          onCancel={() => { if (createPatient.isPending) return; if (dirty) setConfirmLeave(true); else navigate(patientListPath(role)); }}
        />
      </SurfaceCard>
      <ConfirmDialog open={confirmLeave} title={t("discardChanges")} description={t("discardChanges")} onClose={() => setConfirmLeave(false)} pending={createPatient.isPending}><button className="v2-button secondary" type="button" onClick={() => setConfirmLeave(false)}>{t("keepEditing")}</button><button className="v2-button danger" type="button" onClick={() => { setDirty(false); navigate(patientListPath(role)); }}>{t("discard")}</button></ConfirmDialog>
    </div>
  );
}
