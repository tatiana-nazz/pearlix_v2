import { Navigate, useNavigate } from "react-router-dom";

import { PageHeaderV2, SurfaceCard } from "../../components/v2";
import { PatientForm, createPayloadFromForm } from "../../features/patients/components/PatientForm";
import { useCreatePatient } from "../../features/patients/hooks/usePatientMutations";
import { patientListPath, patientProfilePath } from "../../features/patients/utils/patientPermissions";
import type { UserRole } from "../../types/auth";
import type { PatientFormValues } from "../../features/patients/utils/patientFormMapping";

interface NewPatientPageProps {
  role: UserRole;
}

export function NewPatientPage({ role }: NewPatientPageProps) {
  const navigate = useNavigate();
  const createPatient = useCreatePatient();

  if (role !== "STAFF") return <Navigate to="/access-denied" replace />;

  async function handleSubmit(values: PatientFormValues) {
    const patient = await createPatient.mutateAsync(createPayloadFromForm(values));
    navigate(patientProfilePath(role, patient.id));
  }

  return (
    <div className="patient-page narrow">
      <PageHeaderV2 title="Add Patient" description="Create a patient record using the clinic patient API." />
      <SurfaceCard major>
        <PatientForm
          mode="create"
          role={role}
          submitLabel="Create patient"
          isSubmitting={createPatient.isPending}
          error={createPatient.error}
          onSubmit={handleSubmit}
          onCancel={() => navigate(patientListPath(role))}
        />
      </SurfaceCard>
    </div>
  );
}
