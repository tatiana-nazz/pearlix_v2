import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { WorkspaceTabs } from "../../components/WorkspaceTabs";
import { Button, ClickableRow, DataTableShell, PageHeaderV2, SelectField, StatePanel } from "../../components/v2";
import { XrayList } from "../../features/xrays/components/XrayList";
import { XrayUploadDialog } from "../../features/xrays/components/XrayUploadDialog";
import { useExternalXrayMutations, useExternalXrays, useXrays } from "../../features/xrays/hooks/useXrays";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";
import { formatDateTime } from "../../utils/dates";
import { displayText } from "../../utils/formatters";

function statusLabel(status: string, t: ReturnType<typeof useFeatureT>) { return status === "TEMPORARY" ? t("temporary") : status === "ATTACHED_TO_PATIENT" ? t("attachedToPatient") : t("discarded"); }

function PatientXrays({ role }: { role: UserRole }) {
  const t = useFeatureT(); const [params, setParams] = useSearchParams(); const page = Math.max(1, Number(params.get("patient_page") || "1")); const xrays = useXrays({ page });
  function setPage(next: number) { const nextParams = new URLSearchParams(params); nextParams.set("patient_page", String(next)); setParams(nextParams); }
  return <>{xrays.isLoading ? <StatePanel state="loading" title={t("loadingXrays")} /> : null}{xrays.isError ? <StatePanel state="error" title={t("xrayUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void xrays.refetch()}>{t("retry")}</Button>} /> : null}{xrays.data ? <><XrayList role={role} xrays={xrays.data.results} /><div className="pagination-bar"><span>{xrays.data.count} {t("records")}</span><div><Button compact variant="secondary" disabled={!xrays.data.previous || page <= 1} onClick={() => setPage(page - 1)}>{t("previous")}</Button><span className="bidi-isolate">{t("page")} {page}</span><Button compact variant="secondary" disabled={!xrays.data.next} onClick={() => setPage(page + 1)}>{t("next")}</Button></div></div></> : null}</>;
}

function UnassignedCases({ role }: { role: Exclude<UserRole, "STAFF"> }) {
  const t = useFeatureT(); const navigate = useNavigate(); const [params, setParams] = useSearchParams(); const page = Math.max(1, Number(params.get("case_page") || "1")); const status = params.get("case_status") || "";
  const external = useExternalXrays({ page, status: status || undefined });
  function update(update: Record<string, string | null>) { const next = new URLSearchParams(params); Object.entries(update).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setParams(next); }
  return <><div className="xray-filter"><SelectField label={t("status")} value={status} onChange={(event) => update({ case_status: event.target.value || null, case_page: "1" })}><option value="">{t("allStatuses")}</option><option value="TEMPORARY">{t("temporary")}</option><option value="ATTACHED_TO_PATIENT">{t("attachedToPatient")}</option><option value="DISCARDED">{t("discarded")}</option></SelectField></div>
    {external.isLoading ? <StatePanel state="loading" title={t("loadingExternalXrays")} /> : null}{external.isError ? <StatePanel state="error" title={t("externalUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void external.refetch()}>{t("retry")}</Button>} /> : null}{external.data ? <><DataTableShell title={t("unassignedCases")} count={external.data.count} state={external.data.results.length ? undefined : <p>{t("noExternalXrays")}</p>}><table className="xray-table"><thead><tr><th>{t("externalCase")}</th><th>{t("uploadedBy")}</th><th>{t("uploaded")}</th><th>{t("status")}</th><th>{t("aiResult")}</th></tr></thead><tbody>{external.data.results.map((item) => <ClickableRow key={item.id} onOpen={() => navigate(`/${role.toLowerCase()}/xrays/cases/${item.id}`)}><td><strong className="bidi-isolate">{displayText(item.title, item.original_file_name)}</strong><span className="bidi-isolate">{item.content_type}</span></td><td className="bidi-isolate">{item.uploaded_by.full_name}</td><td className="bidi-isolate">{formatDateTime(item.created_at)}</td><td>{statusLabel(item.status, t)}</td><td>{item.has_ai_result ? t("aiAvailable") : t("aiNotRun")}</td></ClickableRow>)}</tbody></table></DataTableShell><div className="pagination-bar"><span>{external.data.count} {t("records")}</span><div><Button compact variant="secondary" disabled={!external.data.previous || page <= 1} onClick={() => update({ case_page: String(page - 1) })}>{t("previous")}</Button><span className="bidi-isolate">{t("page")} {page}</span><Button compact variant="secondary" disabled={!external.data.next} onClick={() => update({ case_page: String(page + 1) })}>{t("next")}</Button></div></div></> : null}
    </>;
}

export function XrayWorkspacePage({ role }: { role: UserRole }) {
  const t = useFeatureT(); const [params] = useSearchParams(); const tabs = role === "STAFF" ? [{ id: "patient", label: t("patientXrays") }] : [{ id: "patient", label: t("patientXrays") }, { id: "unassigned", label: t("unassignedCases") }]; const selected = tabs.some((item) => item.id === params.get("tab")) ? params.get("tab")! : "patient";
  const mutations = useExternalXrayMutations(); const [uploadOpen, setUploadOpen] = useState(false);
  return <div className="xray-page"><PageHeaderV2 title={t("xraysAi")} description={selected === "unassigned" ? t("unassignedCasesDescription") : t("savedXraysDescription")} action={selected === "unassigned" && role !== "STAFF" ? <Button type="button" onClick={() => { mutations.upload.reset(); setUploadOpen(true); }}>{t("uploadUnassignedXray")}</Button> : undefined} /><WorkspaceTabs tabs={tabs} defaultTab="patient" ariaLabel={t("xrayTabs")} />{selected === "patient" ? <PatientXrays role={role} /> : null}{selected === "unassigned" && role !== "STAFF" ? <UnassignedCases role={role} /> : null}{uploadOpen ? <XrayUploadDialog title={t("uploadUnassignedXray")} isSubmitting={mutations.upload.isPending} error={mutations.upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => { void mutations.upload.mutateAsync(payload).then(() => setUploadOpen(false)); }} /> : null}</div>;
}
