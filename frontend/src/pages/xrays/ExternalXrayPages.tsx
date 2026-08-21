import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BackLink } from "../../components/BackLink";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { ExternalXrayDetail } from "../../features/xrays/components/ExternalXrayDetail";
import { XrayUploadDialog } from "../../features/xrays/components/XrayUploadDialog";
import { useExternalXray, useExternalXrayMutations, useExternalXrays } from "../../features/xrays/hooks/useXrays";
import type { UserRole } from "../../types/auth";
import { formatDateTime } from "../../utils/dates";
import { displayText } from "../../utils/formatters";

export function ExternalXrayListPage({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const external = useExternalXrays({ page });
  const mutations = useExternalXrayMutations();
  const [uploadOpen, setUploadOpen] = useState(false);
  return <div className="xray-page"><PageHeader eyebrow={`${role.toLowerCase()} workspace`} title="External X-ray Workspace" description={role === "ADMIN" ? "Temporary cases across the clinic." : "Your temporary external X-ray cases."} actions={<button className="button primary" type="button" onClick={() => { mutations.upload.reset(); setUploadOpen(true); }}>Upload external X-ray</button>} />
    {external.isLoading ? <LoadingState title="Loading external X-rays..." /> : null}{external.isError ? <ErrorState error={external.error} title="Unable to load external X-rays" onRetry={() => void external.refetch()} /> : null}
    {external.data ? (external.data.results.length ? <><Card><div className="table-scroll"><table className="xray-table"><thead><tr><th>Case</th><th>Uploaded by</th><th>Created</th><th>Status</th></tr></thead><tbody>{external.data.results.map((item) => <tr key={item.id} className="clickable-row" tabIndex={0} onClick={() => navigate(`/${role.toLowerCase()}/external-xrays/${item.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/${role.toLowerCase()}/external-xrays/${item.id}`); } }}><td><strong>{displayText(item.title, item.original_file_name)}</strong><span className="table-secondary-text">{item.content_type}</span></td><td>{item.uploaded_by.full_name}</td><td>{formatDateTime(item.created_at)}</td><td><StatusPill status={item.status} /></td></tr>)}</tbody></table></div></Card><div className="pagination-bar" aria-label="External X-ray pagination"><span>Page {page}</span><div><button className="button secondary" disabled={!external.data.previous} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className="button secondary" disabled={!external.data.next} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></> : <EmptyState title="No external X-ray cases found." />) : null}
    {uploadOpen ? <XrayUploadDialog title="Upload external X-ray" isSubmitting={mutations.upload.isPending} error={mutations.upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => void mutations.upload.mutateAsync(payload).then(() => setUploadOpen(false))} /> : null}
  </div>;
}

export function ExternalXrayDetailPage({ role }: { role: UserRole }) {
  const external = useExternalXray(Number(useParams().caseId));
  return <div className="xray-page"><BackLink to={`/${role.toLowerCase()}/external-xrays`}>Back to External X-rays</BackLink><PageHeader eyebrow={`${role.toLowerCase()} workspace`} title="External X-ray Case" description="Temporary cases use protected media and explicit lifecycle actions." />{external.isLoading ? <LoadingState title="Loading external X-ray..." /> : null}{external.isError ? <ErrorState error={external.error} title="External X-ray unavailable" onRetry={() => void external.refetch()} /> : null}{external.data ? <ExternalXrayDetail role={role} external={external.data} /> : null}</div>;
}
