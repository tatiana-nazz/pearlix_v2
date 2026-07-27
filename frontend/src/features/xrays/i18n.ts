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
  aiAnalysisDetails: string;
  noResult: string;
  unavailable: string;
  disclaimer: string;
  showOverlay: string;
  hideOverlay: string;
  originalImage: string;
  protectedUnavailable: string;
  loadingOriginal: string;
  loadingOverlay: string;
  overlayUnavailable: string;
  retry: string;
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
  selectedXray: string;
  runAi: string;
  runningAi: string;
  aiServiceUnavailable: string;
  aiRequestFailed: string;
  loadingAiResult: string;
  aiResultUnavailable: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  fitToView: string;
  fullscreen: string;
  exitFullscreen: string;
  overallConfidence: string;
  modelVersion: string;
  researchOnly: string;
  requiresInterpretation: string;
  notDiagnosis: string;
  overlayAvailability: string;
  available: string;
  notAvailable: string;
  fdi: string;
  finding: string;
  created: string;
  uploadFailed: string;
  aiOverlay: string;
  overlayOn: string;
  overlayOff: string;
  noOverlayAvailable: string;
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
  aiResult: "AI Result",
  aiAnalysisDetails: "AI Analysis Details",
  noResult: "No stored AI result is available for this X-ray.",
  unavailable: "AI analysis is unavailable in this environment. Stored results, when present, remain available for review.",
  disclaimer: "AI-assisted information requires professional interpretation and is not a clinical diagnosis.",
  showOverlay: "Show AI Overlay",
  hideOverlay: "Hide AI Overlay",
  originalImage: "Protected original image",
  protectedUnavailable: "The protected image is unavailable. Check your access and try again.",
  loadingOriginal: "Loading protected original image…",
  loadingOverlay: "Loading AI overlay…",
  overlayUnavailable: "The AI overlay is unavailable. The original image remains available.",
  retry: "Retry",
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
  selectedXray: "Selected X-ray",
  runAi: "Run AI Analysis",
  runningAi: "Running AI Analysis…",
  aiServiceUnavailable: "AI analysis is not configured for this environment. The saved X-ray remains available for review.",
  aiRequestFailed: "Unable to run AI analysis. Review the message and try again.",
  loadingAiResult: "Loading AI result…",
  aiResultUnavailable: "AI result unavailable",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  reset: "Reset",
  fitToView: "Fit to View",
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit Fullscreen",
  overallConfidence: "Overall Confidence",
  modelVersion: "Model Version",
  researchOnly: "Research-only AI analysis",
  requiresInterpretation: "Requires professional interpretation",
  notDiagnosis: "Not a clinical diagnosis",
  overlayAvailability: "Overlay availability",
  available: "Available",
  notAvailable: "Unavailable",
  fdi: "FDI",
  finding: "Finding",
  created: "Created",
  uploadFailed: "Unable to upload X-ray",
  aiOverlay: "AI Overlay",
  overlayOn: "On",
  overlayOff: "Off",
  noOverlayAvailable: "No AI overlay is available for this X-ray.",
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
  aiResult: "نتيجة الذكاء الاصطناعي",
  aiAnalysisDetails: "تفاصيل تحليل الذكاء الاصطناعي",
  noResult: "لا توجد نتيجة محفوظة للذكاء الاصطناعي لهذه الأشعة.",
  unavailable: "تحليل الذكاء الاصطناعي غير متاح في هذه البيئة. تبقى النتائج المحفوظة، إن وجدت، متاحة للمراجعة.",
  disclaimer: "تتطلب المعلومات المدعومة بالذكاء الاصطناعي تفسيراً مهنياً وليست تشخيصاً طبياً.",
  showOverlay: "إظهار طبقة الذكاء الاصطناعي",
  hideOverlay: "إخفاء طبقة الذكاء الاصطناعي",
  originalImage: "الصورة الأصلية المحمية",
  protectedUnavailable: "الصورة المحمية غير متاحة. تحقق من صلاحية الوصول وحاول مجدداً.",
  loadingOriginal: "جارٍ تحميل الصورة الأصلية المحمية…",
  loadingOverlay: "جارٍ تحميل طبقة الذكاء الاصطناعي…",
  overlayUnavailable: "طبقة الذكاء الاصطناعي غير متاحة. ما زالت الصورة الأصلية متاحة.",
  retry: "إعادة المحاولة",
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
  selectedXray: "الأشعة المحددة",
  runAi: "تشغيل تحليل الذكاء الاصطناعي",
  runningAi: "جارٍ تشغيل تحليل الذكاء الاصطناعي…",
  aiServiceUnavailable: "تحليل الذكاء الاصطناعي غير مهيأ لهذه البيئة. تبقى الأشعة المحفوظة متاحة للمراجعة.",
  aiRequestFailed: "تعذر تشغيل تحليل الذكاء الاصطناعي. راجع الرسالة وحاول مجدداً.",
  loadingAiResult: "جارٍ تحميل نتيجة الذكاء الاصطناعي…",
  aiResultUnavailable: "نتيجة الذكاء الاصطناعي غير متاحة",
  zoomIn: "تكبير",
  zoomOut: "تصغير",
  reset: "إعادة ضبط",
  fitToView: "ملاءمة للعرض",
  fullscreen: "ملء الشاشة",
  exitFullscreen: "إنهاء ملء الشاشة",
  overallConfidence: "الثقة الإجمالية",
  modelVersion: "إصدار النموذج",
  researchOnly: "تحليل ذكاء اصطناعي للبحث فقط",
  requiresInterpretation: "يتطلب تفسيراً مهنياً",
  notDiagnosis: "ليس تشخيصاً سريرياً",
  overlayAvailability: "توفر الطبقة",
  available: "متاحة",
  notAvailable: "غير متاحة",
  fdi: "FDI",
  finding: "النتيجة",
  created: "تاريخ الإنشاء",
  uploadFailed: "تعذر رفع الأشعة",
  aiOverlay: "طبقة الذكاء الاصطناعي",
  overlayOn: "تشغيل",
  overlayOff: "إيقاف",
  noOverlayAvailable: "لا تتوفر طبقة ذكاء اصطناعي لهذه الأشعة.",
};

export function xrayCopy(language?: LanguagePreference | null): XrayCopy {
  return language === "AR" ? ar : en;
}
