import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

import { clinicApi } from "../../api/endpoints/clinic";
import { useAuthStore } from "../../auth/authStore";
import { Button, ConfirmDialog, Field, FormSection, PageHeaderV2, SelectField, StatePanel, StickyActionBar, SurfaceCard } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import type { AiMode, ClinicSettings, ClinicSettingsUpdatePayload, Currency, Language } from "../../types/clinic";
import { getErrorMessage } from "../../utils/apiErrors";

const durations = [15, 30, 45, 60] as const;
const currencies = ["SYP", "USD"] as const;
const aiModes = ["DJANGO_INTERNAL", "SEPARATE_SERVICE", "MOCK_ADAPTER"] as const;
const editableSettingKeys = ["clinic_name", "address", "phone", "email", "timezone", "capacity_per_slot", "default_appointment_duration_minutes", "allowed_durations_minutes", "default_currency", "supported_currencies", "default_language", "ai_mode", "ai_service_url"] as const satisfies readonly (keyof ClinicSettings)[];
type Duration = (typeof durations)[number];
type EditableSettingKey = (typeof editableSettingKeys)[number];

function fullSettings(value: unknown): value is ClinicSettings { return Boolean(value && typeof value === "object" && "ai_mode" in value); }
function cloneSettings(value: ClinicSettings): ClinicSettings { return { ...value, allowed_durations_minutes: [...value.allowed_durations_minutes], supported_currencies: [...value.supported_currencies] }; }
function arraysEqual<T>(left: readonly T[], right: readonly T[]) { return left.length === right.length && left.every((item, index) => item === right[index]); }
function settingsChanged(base: ClinicSettings, value: ClinicSettings) { return editableSettingKeys.some((key) => { const previous = base[key]; const next = value[key]; return Array.isArray(next) && Array.isArray(previous) ? !arraysEqual<unknown>(next, previous) : next !== previous; }); }
function setPayloadValue<K extends EditableSettingKey>(payload: ClinicSettingsUpdatePayload, key: K, value: ClinicSettings[K]) { payload[key] = value; }
function changedSettingsPayload(base: ClinicSettings, value: ClinicSettings): ClinicSettingsUpdatePayload { const payload: ClinicSettingsUpdatePayload = {}; editableSettingKeys.forEach((key) => { const previous = base[key]; const next = value[key]; if (Array.isArray(next) && Array.isArray(previous) ? !arraysEqual<unknown>(next, previous) : next !== previous) setPayloadValue(payload, key, next); }); return payload; }
function isDuration(value: number): value is Duration { return durations.some((duration) => duration === value); }
function isCurrency(value: string): value is Currency { return currencies.some((currency) => currency === value); }
function isAiMode(value: string): value is AiMode { return aiModes.some((mode) => mode === value); }
function isLanguage(value: string): value is Language { return value === "EN" || value === "AR"; }
function isValidServiceUrl(value: string) { if (!value.trim()) return true; try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; } }

function ClinicSettingsForm() {
  const t = useFeatureT();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["clinic-settings"], queryFn: clinicApi.getSettings });
  const [base, setBase] = useState<ClinicSettings | null>(null);
  const [value, setValue] = useState<ClinicSettings | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const blockRef = useRef(false);

  useEffect(() => {
    if (query.data && fullSettings(query.data) && !base) {
      const next = cloneSettings(query.data);
      setBase(next);
      setValue(cloneSettings(next));
    }
  }, [base, query.data]);

  const mutation = useMutation({
    mutationFn: clinicApi.updateSettings,
    onSuccess: (next) => {
      const clean = cloneSettings(next);
      setBase(clean);
      setValue(cloneSettings(clean));
      setSaved(true);
      for (const key of ["clinic-settings", "dashboard", "appointments", "billing-handoffs", "invoices", "invoice-print-data", "xrays", "xray-ai-result", "external-xrays", "external-xray-ai-result", "ai-results", "ai-configuration"]) void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const changed = Boolean(base && value && settingsChanged(base, value));
  const blockNavigation = changed || mutation.isPending;
  blockRef.current = blockNavigation;
  const blocker = useBlocker(blockNavigation);

  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => { if (blockRef.current) { event.preventDefault(); event.returnValue = ""; } };
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, []);
  useEffect(() => { if (blocker.state === "blocked") setConfirm(true); }, [blocker.state]);
  useEffect(() => { if (!blockNavigation && blocker.state === "blocked") { blocker.reset(); setConfirm(false); } }, [blockNavigation, blocker]);

  if (query.isError || (!fullSettings(query.data) && !query.isLoading)) return <StatePanel state="error" title={t("settingsUnavailable")} description={query.error ? getErrorMessage(query.error) : undefined} action={<Button type="button" onClick={() => void query.refetch()}>{t("retry")}</Button>} />;
  if (query.isLoading || !base || !value) return <StatePanel state="loading" title={t("clinicSettings")} />;

  const error = {
    capacity: value.capacity_per_slot < 1,
    duration: !value.allowed_durations_minutes.length || !value.allowed_durations_minutes.every(isDuration) || !isDuration(value.default_appointment_duration_minutes) || !value.allowed_durations_minutes.includes(value.default_appointment_duration_minutes),
    currency: !value.supported_currencies.length || !value.supported_currencies.every(isCurrency) || !isCurrency(value.default_currency) || !value.supported_currencies.includes(value.default_currency),
    email: Boolean(value.email) && !/^\S+@\S+\.\S+$/.test(value.email),
    zone: !value.timezone.trim(),
    url: !isValidServiceUrl(value.ai_service_url),
  };
  const invalid = Object.values(error).some(Boolean);
  const set = <K extends EditableSettingKey>(key: K, next: ClinicSettings[K]) => { setSaved(false); setValue((current) => current ? { ...current, [key]: next } : current); };
  const toggleDuration = (duration: Duration) => setValue((current) => { if (!current) return current; setSaved(false); const allowed = current.allowed_durations_minutes.includes(duration) ? current.allowed_durations_minutes.filter((item) => item !== duration) : [...current.allowed_durations_minutes, duration]; return { ...current, allowed_durations_minutes: allowed }; });
  const toggleCurrency = (currency: Currency) => setValue((current) => { if (!current) return current; setSaved(false); const supported = current.supported_currencies.includes(currency) ? current.supported_currencies.filter((item) => item !== currency) : [...current.supported_currencies, currency]; return { ...current, supported_currencies: supported }; });
  const save = () => mutation.mutate(changedSettingsPayload(base, value));

  return <><form onSubmit={(event) => { event.preventDefault(); if (changed && !invalid && !mutation.isPending) save(); }}>
    {saved ? <p role="status" aria-live="polite">{t("settingsSaved")}</p> : null}
    <FormSection title={t("clinicIdentity")}><Field label={t("clinicName")} value={value.clinic_name} onChange={(event) => set("clinic_name", event.target.value)} /><Field label={t("address")} value={value.address} onChange={(event) => set("address", event.target.value)} /><Field label={t("phone")} value={value.phone} onChange={(event) => set("phone", event.target.value)} /><Field label={t("email")} type="email" error={error.email ? t("emailInvalid") : undefined} value={value.email} onChange={(event) => set("email", event.target.value)} /></FormSection>
    <FormSection title={t("scheduling")}><Field label={t("timezone")} error={error.zone ? t("timezoneRequired") : undefined} value={value.timezone} onChange={(event) => set("timezone", event.target.value)} /><Field label={t("capacity")} type="number" min={1} error={error.capacity ? t("capacityInvalid") : undefined} value={value.capacity_per_slot} onChange={(event) => set("capacity_per_slot", Number(event.target.value))} /><fieldset><legend>{t("allowedDurations")}</legend>{durations.map((duration) => <label key={duration}><input type="checkbox" checked={value.allowed_durations_minutes.includes(duration)} onChange={() => toggleDuration(duration)} />{duration}</label>)}</fieldset><SelectField label={t("defaultDuration")} error={error.duration ? t("durationRelationship") : undefined} value={value.default_appointment_duration_minutes} onChange={(event) => set("default_appointment_duration_minutes", Number(event.target.value))}>{durations.map((duration) => <option key={duration} value={duration}>{duration}</option>)}</SelectField></FormSection>
    <FormSection title={t("localizationBilling")}><fieldset><legend>{t("supportedCurrencies")}</legend>{currencies.map((currency) => <label key={currency}><input type="checkbox" checked={value.supported_currencies.includes(currency)} onChange={() => toggleCurrency(currency)} />{currency}</label>)}</fieldset><SelectField label={t("defaultCurrency")} error={error.currency ? t("currencyRelationship") : undefined} value={value.default_currency} onChange={(event) => { if (isCurrency(event.target.value)) set("default_currency", event.target.value); }}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</SelectField><SelectField label={t("defaultLanguage")} value={value.default_language} onChange={(event) => { if (isLanguage(event.target.value)) set("default_language", event.target.value); }}><option value="EN">{t("languageEnglish")}</option><option value="AR">{t("languageArabic")}</option></SelectField></FormSection>
    <FormSection title={t("aiWorkspace")}><p>{t("clinicSettingsHelp")}</p><SelectField label={t("aiMode")} value={value.ai_mode} onChange={(event) => { if (isAiMode(event.target.value)) set("ai_mode", event.target.value); }}><option value="DJANGO_INTERNAL">{t("aiDjangoInternal")}</option><option value="SEPARATE_SERVICE">{t("aiSeparateService")}</option><option value="MOCK_ADAPTER">{t("aiMockAdapter")}</option></SelectField><Field label={t("aiServiceUrl")} type="url" error={error.url ? t("aiUrlInvalid") : undefined} value={value.ai_service_url} onChange={(event) => set("ai_service_url", event.target.value)} /></FormSection>
    <StickyActionBar><Button type="submit" loading={mutation.isPending} disabled={!changed || invalid}>{t("saveSettings")}</Button><Button type="button" variant="secondary" disabled={!changed || mutation.isPending} onClick={() => { setSaved(false); setValue(cloneSettings(base)); }}>{t("discard")}</Button></StickyActionBar>
    {mutation.error ? <StatePanel state="error" title={t("saveFailed")} description={getErrorMessage(mutation.error)} /> : null}
  </form><ConfirmDialog open={confirm} title={t("discardChanges")} pending={mutation.isPending} onClose={() => { if (!mutation.isPending) { blocker.reset?.(); setConfirm(false); } }}><Button variant="secondary" disabled={mutation.isPending} onClick={() => { blocker.reset?.(); setConfirm(false); }}>{t("keepEditing")}</Button><Button variant="danger" disabled={mutation.isPending} onClick={() => { if (!mutation.isPending) { setConfirm(false); blocker.proceed?.(); } }}>{t("discard")}</Button></ConfirmDialog></>;
}

export function AdminClinicSettingsPage() {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  return <div className="admin-page clinic-settings-page" lang={language === "AR" ? "ar" : "en"} dir={language === "AR" ? "rtl" : "ltr"}><PageHeaderV2 title={t("clinicSettings")} description={t("clinicSettingsHelp")} /><SurfaceCard major><ClinicSettingsForm /></SurfaceCard></div>;
}
