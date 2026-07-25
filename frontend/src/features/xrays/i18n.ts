import type { LanguagePreference } from "../../types/auth";

type XrayCopy = {
  savedXrays: string;
  externalWorkspace: string;
  uploadXray: string;
  uploadExternal: string;
  imageFile: string;
  selectedFile: string;
  description: string;
  optionalTitle: string;
  chooseFile: string;
  supportedFiles: string;
  cancel: string;
  upload: string;
  uploading: string;
  aiResult: string;
  noResult: string;
  unavailable: string;
  disclaimer: string;
  showOverlay: string;
  hideOverlay: string;
  originalImage: string;
  protectedUnavailable: string;
  metadata: string;
  findings: string;
  confidence: string;
  model: string;
  version: string;
  processing: string;
  failed: string;
  status: string;
  uploaded: string;
  updated: string;
  noXrays: string;
};

const en: XrayCopy = {
  savedXrays: "Saved X-rays",
  externalWorkspace: "External X-ray workspace",
  uploadXray: "Upload X-ray",
  uploadExternal: "Upload external X-ray",
  imageFile: "Image file",
  selectedFile: "Selected file",
  description: "Description",
  optionalTitle: "Title (optional)",
  chooseFile: "Choose file",
  supportedFiles: "PNG, JPG, or JPEG only. Maximum size 10 MB.",
  cancel: "Cancel",
  upload: "Upload",
  uploading: "Uploading…",
  aiResult: "AI-assisted result",
  noResult: "No stored AI result is available for this X-ray.",
  unavailable: "AI analysis is unavailable in this environment. Stored results, when present, remain available for review.",
  disclaimer: "AI-assisted information requires professional interpretation and is not a clinical diagnosis.",
  showOverlay: "Show overlay",
  hideOverlay: "Hide overlay",
  originalImage: "Protected original image",
  protectedUnavailable: "The protected image is unavailable. Check your access and try again.",
  metadata: "Metadata",
  findings: "Findings",
  confidence: "Confidence",
  model: "Model",
  version: "Version",
  processing: "Processing",
  failed: "Failed",
  status: "Status",
  uploaded: "Uploaded",
  updated: "Updated",
  noXrays: "No X-rays have been saved yet.",
};

const ar: XrayCopy = {
  savedXrays: "الأشعة المحفوظة",
  externalWorkspace: "مساحة عمل الأشعة الخارجية",
  uploadXray: "رفع أشعة",
  uploadExternal: "رفع أشعة خارجية",
  imageFile: "ملف الصورة",
  selectedFile: "الملف المحدد",
  description: "الوصف",
  optionalTitle: "العنوان (اختياري)",
  chooseFile: "اختر ملفاً",
  supportedFiles: "PNG أو JPG أو JPEG فقط. الحد الأقصى للحجم 10 ميغابايت.",
  cancel: "إلغاء",
  upload: "رفع",
  uploading: "جارٍ الرفع…",
  aiResult: "نتيجة مدعومة بالذكاء الاصطناعي",
  noResult: "لا توجد نتيجة محفوظة للذكاء الاصطناعي لهذه الأشعة.",
  unavailable: "تحليل الذكاء الاصطناعي غير متاح في هذه البيئة. تبقى النتائج المحفوظة، إن وجدت، متاحة للمراجعة.",
  disclaimer: "تتطلب المعلومات المدعومة بالذكاء الاصطناعي تفسيراً مهنياً وليست تشخيصاً طبياً.",
  showOverlay: "إظهار الطبقة",
  hideOverlay: "إخفاء الطبقة",
  originalImage: "الصورة الأصلية المحمية",
  protectedUnavailable: "الصورة المحمية غير متاحة. تحقق من صلاحية الوصول وحاول مجدداً.",
  metadata: "البيانات الوصفية",
  findings: "النتائج",
  confidence: "مستوى الثقة",
  model: "النموذج",
  version: "الإصدار",
  processing: "قيد المعالجة",
  failed: "فشل",
  status: "الحالة",
  uploaded: "تاريخ الرفع",
  updated: "آخر تحديث",
  noXrays: "لا توجد أشعة محفوظة بعد.",
};

export function xrayCopy(language?: LanguagePreference | null): XrayCopy {
  return language === "AR" ? ar : en;
}
