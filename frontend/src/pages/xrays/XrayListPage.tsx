import { useSearchParams } from "react-router-dom";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { XrayList } from "../../features/xrays/components/XrayList";
import { useXrays } from "../../features/xrays/hooks/useXrays";
import type { UserRole } from "../../types/auth";

export function XrayListPage({ role }: { role: UserRole }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || "1");
  const xrays = useXrays({ page });
  return <div className="xray-page"><PageHeader eyebrow={`${role.toLowerCase()} workspace`} title="Saved X-rays" description="Review protected saved dental X-rays and existing AI results." />
    {xrays.isLoading ? <LoadingState title="Loading saved X-rays..." /> : null}{xrays.isError ? <ErrorState error={xrays.error} title="Unable to load saved X-rays" onRetry={() => void xrays.refetch()} /> : null}
    {xrays.data ? <><XrayList role={role} xrays={xrays.data.results} /><div className="pagination-bar"><span>{xrays.data.count} records</span><div><button className="button secondary" type="button" disabled={!xrays.data.previous || page <= 1} onClick={() => setSearchParams({ page: String(page - 1) })}>Previous</button><span>Page {page}</span><button className="button secondary" type="button" disabled={!xrays.data.next} onClick={() => setSearchParams({ page: String(page + 1) })}>Next</button></div></div></> : null}
  </div>;
}
