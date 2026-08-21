import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";

import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PatientForm, createPayloadFromForm } from "../../features/patients/components/PatientForm";
import { useCreatePatient } from "../../features/patients/hooks/usePatientMutations";
import { patientListPath, patientProfilePath } from "../../features/patients/utils/patientPermissions";
import type { UserRole } from "../../types/auth";
import type { PatientFormValues } from "../../features/patients/utils/patientFormMapping";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";

interface NewPatientPageProps {
  role: UserRole;
}

export function NewPatientPage({ role }: NewPatientPageProps) {
  const navigate = useNavigate();
  const createPatient = useCreatePatient();
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty, "You have unsaved patient information. Leave this page and discard it?");

  if (role !== "STAFF") return <Navigate to="/access-denied" replace />;

  async function handleSubmit(values: PatientFormValues) {
    const patient = await createPatient.mutateAsync(createPayloadFromForm(values));
    setDirty(false);
    navigate(patientProfilePath(role, patient.id));
  }

  return (
    <div className="patient-page narrow">
      <PageHeader eyebrow="Staff workspace" title="Add Patient" description="Create a patient record using the backend patient API." />
      <Card>
        <PatientForm
          mode="create"
          role={role}
          submitLabel="Create patient"
          isSubmitting={createPatient.isPending}
          error={createPatient.error}
          onSubmit={handleSubmit}
          onCancel={() => navigate(patientListPath(role))}
          onDirtyChange={setDirty}
        />
      </Card>
    </div>
  );
}
