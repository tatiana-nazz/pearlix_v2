import type { LanguagePreference } from "../../types/auth";

const copy = {
  EN: {
    patients: "Patients", patientDirectory: "Patient directory", patientDirectoryDescription: "Search and manage patient records according to your role.", newPatient: "New patient", search: "Search", searchPlaceholder: "Search by name, phone, email, or ID", archiveState: "Archive state", active: "Active", archived: "Archived", clearFilters: "Clear filters", refresh: "Refreshing patient results…", loading: "Loading patients…", loadError: "Unable to load patients", retry: "Retry", noPatients: "No patients found for this filter.", records: "records", previous: "Previous", next: "Next", page: "Page", patient: "Patient", contact: "Contact", gender: "Gender", age: "Age", status: "Status", actions: "Actions", more: "More actions", view: "View", edit: "Edit", archive: "Archive", reactivate: "Reactivate", notRecorded: "Not recorded", overview: "Overview", medicalHistory: "Medical Summary", visits: "Visits", appointments: "Appointments", xraysAi: "X-rays & AI", billing: "Billing", backToPatients: "Back to patients", patientProfile: "Patient profile", yearsOld: "years old", identity: "Identity", generalInformation: "General information", contactDetails: "Contact details", clinicalProfile: "Clinical profile", firstName: "First name", lastName: "Last name", dateOfBirth: "Date of birth", phone: "Phone", email: "Email", nationalId: "National ID or passport", emergencyContact: "Emergency contact", address: "Address", bloodGroup: "Blood group", medicalConditions: "Medical conditions history", insurance: "Insurance information", generalNotes: "General notes", save: "Save patient", saving: "Saving…", cancel: "Cancel", createPatient: "Create patient", saveChanges: "Save changes", editPatient: "Edit patient", noMedicalHistory: "No medical history has been recorded.", noInsurance: "No insurance information has been recorded.", noNotes: "No general notes have been recorded.", updated: "Updated", created: "Created", version: "Version", createdBy: "Created by", updatedBy: "Updated by", archivePatient: "Archive patient", reactivatePatient: "Reactivate patient", archiveDescription: "Archived patients are hidden from active lists and cannot be selected for new appointments. Their record remains stored.", reactivateDescription: "This patient will return to active patient lists.", conflict: "This patient was changed elsewhere. Reload the latest record before saving over it.", continueReviewing: "Continue reviewing my changes", reloadLatest: "Reload latest record", discardChanges: "Discard unsaved changes?", staffOnlyNote: "Doctors can update patient profile fields for active patients only. Archive controls are hidden.", missingPatient: "Patient was not found or is unavailable to this role.", required: "Required", female: "Female", male: "Male", noBloodGroup: "Not recorded",
  },
  AR: {
    patients: "المرضى", patientDirectory: "دليل المرضى", patientDirectoryDescription: "ابحث عن سجلات المرضى وأدرها وفقاً لدورك.", newPatient: "مريض جديد", search: "بحث", searchPlaceholder: "ابحث بالاسم أو الهاتف أو البريد أو المعرّف", archiveState: "حالة السجل", active: "نشط", archived: "مؤرشف", clearFilters: "مسح عوامل التصفية", refresh: "يتم تحديث نتائج المرضى…", loading: "يتم تحميل المرضى…", loadError: "تعذر تحميل المرضى", retry: "إعادة المحاولة", noPatients: "لا يوجد مرضى لهذا التصفية.", records: "سجلات", previous: "السابق", next: "التالي", page: "الصفحة", patient: "المريض", contact: "التواصل", gender: "الجنس", age: "العمر", status: "الحالة", actions: "الإجراءات", more: "إجراءات إضافية", view: "عرض", edit: "تعديل", archive: "أرشفة", reactivate: "إعادة التفعيل", notRecorded: "غير مسجل", overview: "نظرة عامة", medicalHistory: "التاريخ الطبي", visits: "الزيارات", appointments: "المواعيد", xraysAi: "الأشعة والذكاء الاصطناعي", billing: "الفواتير", backToPatients: "العودة إلى المرضى", patientProfile: "ملف المريض", yearsOld: "سنة", identity: "الهوية", generalInformation: "المعلومات العامة", contactDetails: "بيانات التواصل", clinicalProfile: "الملف السريري", firstName: "الاسم الأول", lastName: "اسم العائلة", dateOfBirth: "تاريخ الميلاد", phone: "الهاتف", email: "البريد الإلكتروني", nationalId: "الهوية الوطنية أو جواز السفر", emergencyContact: "جهة اتصال للطوارئ", address: "العنوان", bloodGroup: "فصيلة الدم", medicalConditions: "التاريخ المرضي", insurance: "معلومات التأمين", generalNotes: "ملاحظات عامة", save: "حفظ", saving: "جارٍ الحفظ…", cancel: "إلغاء", createPatient: "إنشاء مريض", saveChanges: "حفظ التغييرات", editPatient: "تعديل المريض", noMedicalHistory: "لا يوجد تاريخ طبي مسجل.", noInsurance: "لا توجد معلومات تأمين مسجلة.", noNotes: "لا توجد ملاحظات عامة مسجلة.", updated: "آخر تحديث", created: "تاريخ الإنشاء", version: "الإصدار", createdBy: "أنشئ بواسطة", updatedBy: "حُدّث بواسطة", archivePatient: "أرشفة المريض", reactivatePatient: "إعادة تفعيل المريض", archiveDescription: "يُخفى المرضى المؤرشفون من القوائم النشطة ولا يمكن اختيارهم للمواعيد الجديدة، مع الاحتفاظ بالسجل.", reactivateDescription: "سيعود هذا المريض إلى قوائم المرضى النشطة.", conflict: "عُدل هذا المريض في مكان آخر. أعد تحميل أحدث سجل قبل الحفظ.", reloadLatest: "إعادة تحميل أحدث سجل", continueReviewing: "متابعة مراجعة التغييرات", discardChanges: "تجاهل التغييرات غير المحفوظة؟", staffOnlyNote: "يمكن للموظفين فقط إنشاء سجلات المرضى أو أرشفتها أو إعادة تفعيلها.", missingPatient: "لم يتم العثور على المريض أو أنه غير متاح لهذا الدور.", required: "مطلوب", female: "أنثى", male: "ذكر", noBloodGroup: "غير مسجل",
  },
} as const;

const supplementalCopy = {
  EN: {
    directoryStaffDescription: "Create, update, archive, and reactivate patient records according to backend permissions.",
    directoryDoctorDescription: "Clinic-wide active patient access with profile editing where backend rules allow.",
    directoryAdminDescription: "Read-only patient access for clinic supervision.",
    workspace: "workspace",
    loadingProfile: "Loading patient profile…",
    loadProfileError: "Unable to load patient profile",
    invalidPatient: "Patient was not found.",
    reloadPatientConfirm: "Reload the latest patient record and discard unsaved edits?",
    billingUnavailableDoctor: "Billing and invoices are not available in the Doctor workspace.",
    overviewDescription: "Contact, demographic, and record metadata.",
    medicalSummaryDescription: "Profile-level summary and general notes. Clinical visit notes are handled in the Visits phase.",
    noMedicalSummary: "No medical summary has been recorded.",
    editSummary: "Edit summary",
    patientFilters: "Patient filters",
    patientScope: "Patient scope",
    allPatients: "All patients",
    lastVisit: "Last visit",
    nextAppointment: "Next appointment",
    years: "years",
    myPatients: "My patients",
    upcomingWithMe: "Upcoming with me",
    lastVisitWithMe: "Last visit with me",
    ageNotRecorded: "Age not recorded",
    patientLabel: "Patient",
    archiveStoredDescription: "Archived patients are hidden from active patient lists. The patient record remains stored.",
    archivePatient: "Archive Patient",
    unarchivePatient: "Unarchive Patient",
  },
  AR: {
    directoryStaffDescription: "\u0625\u0646\u0634\u0627\u0621 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0631\u0636\u0649 \u0648\u062a\u062d\u062f\u064a\u062b\u0647\u0627 \u0648\u0623\u0631\u0634\u0641\u062a\u0647\u0627 \u0648\u0625\u0639\u0627\u062f\u0629 \u062a\u0641\u0639\u064a\u0644\u0647\u0627 \u0648\u0641\u0642 \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0627\u0644\u062e\u0627\u062f\u0645.",
    directoryDoctorDescription: "\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0631\u0636\u0649 \u0627\u0644\u0646\u0634\u0637\u064a\u0646 \u0641\u064a \u0627\u0644\u0639\u064a\u0627\u062f\u0629 \u0645\u0639 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641 \u062d\u064a\u062b\u0645\u0627 \u062a\u0633\u0645\u062d \u0642\u0648\u0627\u0639\u062f \u0627\u0644\u062e\u0627\u062f\u0645.",
    directoryAdminDescription: "\u0648\u0635\u0648\u0644 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637 \u0625\u0644\u0649 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0631\u0636\u0649 \u0644\u0644\u0625\u0634\u0631\u0627\u0641 \u0639\u0644\u0649 \u0627\u0644\u0639\u064a\u0627\u062f\u0629.",
    workspace: "\u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644",
    loadingProfile: "\u064a\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u064a\u0636…",
    loadProfileError: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u064a\u0636",
    invalidPatient: "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0631\u064a\u0636.",
    reloadPatientConfirm: "\u0625\u0639\u0627\u062f\u0629 \u062a\u062d\u0645\u064a\u0644 \u0623\u062d\u062f\u062b \u0633\u062c\u0644 \u0644\u0644\u0645\u0631\u064a\u0636 \u0648\u062a\u062c\u0627\u0647\u0644 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629\u061f",
    billingUnavailableDoctor: "\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0648\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0641\u064a \u0645\u0633\u0627\u062d\u0629 \u0639\u0645\u0644 \u0627\u0644\u0637\u0628\u064a\u0628.",
    overviewDescription: "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0648\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0633\u0643\u0627\u0646\u064a\u0629 \u0648\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0633\u062c\u0644.",
    medicalSummaryDescription: "\u0645\u0644\u062e\u0635 \u0644\u0644\u0645\u0644\u0641 \u0648\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0639\u0627\u0645\u0629. \u062a\u0639\u0627\u0644\u062c \u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629 \u0641\u064a \u0645\u0631\u062d\u0644\u0629 \u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a.",
    noMedicalSummary: "\u0644\u0645 \u064a\u064f\u0633\u062c\u0644 \u0623\u064a \u0645\u0644\u062e\u0635 \u0637\u0628\u064a \u0628\u0639\u062f.",
    editSummary: "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u062e\u0635",
    patientFilters: "\u0639\u0648\u0627\u0645\u0644 \u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u0645\u0631\u0636\u0649",
    patientScope: "\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u0631\u0636\u0649",
    allPatients: "\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0631\u0636\u0649",
    lastVisit: "\u0622\u062e\u0631 \u0632\u064a\u0627\u0631\u0629",
    nextAppointment: "\u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0642\u0627\u062f\u0645",
    years: "\u0633\u0646\u0629",
    myPatients: "\u0645\u0631\u0636\u0627\u064a",
    upcomingWithMe: "\u0645\u0648\u0627\u0639\u064a\u062f\u064a \u0627\u0644\u0642\u0627\u062f\u0645\u0629",
    lastVisitWithMe: "\u0622\u062e\u0631 \u0632\u064a\u0627\u0631\u0629 \u0645\u0639\u064a",
    ageNotRecorded: "\u0627\u0644\u0639\u0645\u0631 \u063a\u064a\u0631 \u0645\u0633\u062c\u0644",
    patientLabel: "\u0627\u0644\u0645\u0631\u064a\u0636",
    archiveStoredDescription: "\u064a\u064f\u062e\u0641\u0649 \u0627\u0644\u0645\u0631\u0636\u0649 \u0627\u0644\u0645\u0624\u0631\u0634\u0641\u0648\u0646 \u0645\u0646 \u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0645\u0631\u0636\u0649 \u0627\u0644\u0646\u0634\u0637\u0629. \u064a\u0628\u0642\u0649 \u0633\u062c\u0644 \u0627\u0644\u0645\u0631\u064a\u0636 \u0645\u062d\u0641\u0648\u0638\u0627\u064b.",
    archivePatient: "\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0631\u064a\u0636",
    unarchivePatient: "\u0625\u0644\u063a\u0627\u0621 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0631\u064a\u0636",
  },
} as const;

export type PatientCopy = Record<keyof typeof copy.EN | keyof typeof supplementalCopy.EN, string>;

export function patientCopy(language: LanguagePreference | string | undefined): PatientCopy {
  const locale = language === "AR" ? "AR" : "EN";
  return { ...copy[locale], ...supplementalCopy[locale] };
}
