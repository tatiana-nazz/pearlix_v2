import type { XrayUploadPayload } from "../../../types/xrays";

const allowedTypes = new Set(["image/png", "image/jpeg"]);
const allowedExtensions = [".png", ".jpg", ".jpeg"];
export const maxXraySizeBytes = 10 * 1024 * 1024;

export function validateXrayFile(file: File | null): string | null {
  if (!file) return "Select a PNG or JPEG image.";
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedTypes.has(file.type) || !allowedExtensions.includes(extension)) return "Supported formats are PNG, JPG, and JPEG.";
  if (file.size > maxXraySizeBytes) return "The maximum X-ray file size is 10 MB.";
  return null;
}

export function xrayUploadFormData(payload: XrayUploadPayload): FormData {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.title?.trim()) formData.append("title", payload.title.trim());
  if (payload.notes?.trim()) formData.append("notes", payload.notes.trim());
  return formData;
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
