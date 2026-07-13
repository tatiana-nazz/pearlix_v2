import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button, ClickableRow, DataTableShell, PageHeaderV2, SelectField, StatePanel } from "../../components/v2";
import { ExternalXrayDetail } from "../../features/xrays/components/ExternalXrayDetail";
import { XrayUploadDialog } from "../../features/xrays/components/XrayUploadDialog";
import { useExternalXray, useExternalXrayMutations, useExternalXrays } from "../../features/xrays/hooks/useXrays";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";
import { formatDateTime } from "../../utils/dates";
import { displayText } from "../../utils/formatters";

function statusLabel(status: string, t: ReturnType<typeof useFeatureT>) {
  return status === "TEMPORARY" ? t("temporary") : status === "ATTACHED_TO_PATIENT" ? t("attachedToPatient") : t("discarded");
}

export function ExternalXrayListPage({ role }: { role: UserRole }) {
  const t = useFeatureT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";
  const external = useExternalXrays({ page, status: status || undefined, uploaded_by: searchParams.get("uploaded_by") || undefined, created_from: searchParams.get("created_from") || undefined, created_to: searchParams.get("created_to") || undefined });
  const mutations = useExternalXrayMutations();
  const [uploadOpen, setUploadOpen] = useState(false);
  function updateParams(update: Record<string, string | null>) { const next = new URLSearchParams(searchParams); Object.entries(update).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setSearchParams(next); }
  function setPage(nextPage: number) { updateParams({ page: String(nextPage) }); }
  return <div className="xray-page"><PageHeaderV2 title={t("externalWorkspace")} description={role === "ADMIN" ? t("externalDescriptionAdmin") : t("externalDescriptionDoctor")} action={<Button type="button" onClick={() => { mutations.upload.reset(); setUploadOpen(true); }}>{t("uploadExternalXray")}</Button>} />
    <div className="xray-filter"><SelectField label={t("status")} value={status} onChange={(event) => updateParams({ status: event.target.value || null, page: "1" })}><option value="">{t("allStatuses")}</option><option value="TEMPORARY">{t("temporary")}</option><option value="ATTACHED_TO_PATIENT">{t("attachedToPatient")}</option><option value="DISCARDED">{t("discarded")}</option></SelectField></div>
    {external.isLoading ? <StatePanel state="loading" title={t("loadingExternalXrays")} /> : null}{external.isError ? <StatePanel state="error" title={t("externalUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void external.refetch()}>{t("retry")}</Button>} /> : null}
    {external.data ? <><DataTableShell title={t("externalWorkspace")} count={external.data.count} state={external.data.results.length ? undefined : <p>{t("noExternalXrays")}</p>}><table className="xray-table"><thead><tr><th>{t("externalCase")}</th><th>{t("uploadedBy")}</th><th>{t("uploaded")}</th><th>{t("status")}</th><th>{t("aiResult")}</th></tr></thead><tbody>{external.data.results.map((item) => <ClickableRow key={item.id} onOpen={() => navigate(`/${role.toLowerCase()}/external-xrays/${item.id}`)}><td><strong className="bidi-isolate">{displayText(item.title, item.original_file_name)}</strong><span className="bidi-isolate">{item.content_type}</span></td><td className="bidi-isolate">{item.uploaded_by.full_name}</td><td className="bidi-isolate">{formatDateTime(item.created_at)}</td><td>{statusLabel(item.status, t)}</td><td>{item.has_ai_result ? t("aiAvailable") : t("aiNotRun")}</td></ClickableRow>)}</tbody></table></DataTableShell><div className="pagination-bar"><span>{external.data.count} {t("records")}</span><div><Button compact variant="secondary" disabled={!external.data.previous || page <= 1} onClick={() => setPage(page - 1)}>{t("previous")}</Button><span className="bidi-isolate">{t("page")} {page}</span><Button compact variant="secondary" disabled={!external.data.next} onClick={() => setPage(page + 1)}>{t("next")}</Button></div></div></> : null}
    {uploadOpen ? <XrayUploadDialog title={t("uploadExternalXray")} isSubmitting={mutations.upload.isPending} error={mutations.upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => { void mutations.upload.mutateAsync(payload).then(() => setUploadOpen(false)); }} /> : null}
  </div>;
}

export function ExternalXrayDetailPage({ role }: { role: UserRole }) {
  const t = useFeatureT();
  const external = useExternalXray(Number(useParams().caseId));
  return <div className="xray-page"><PageHeaderV2 title={t("externalCase")} description={t("externalCaseDescription")} />{external.isLoading ? <StatePanel state="loading" title={t("loadingExternalXrays")} /> : null}{external.isError ? <StatePanel state="error" title={t("externalUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void external.refetch()}>{t("retry")}</Button>} /> : null}{external.data ? <ExternalXrayDetail role={role} external={external.data} /> : null}</div>;
}
