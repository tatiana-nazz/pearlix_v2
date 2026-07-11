import { useParams } from "react-router-dom";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { XrayDetail } from "../../features/xrays/components/XrayDetail";
import { useXray } from "../../features/xrays/hooks/useXrays";
import type { UserRole } from "../../types/auth";

export function XrayDetailPage({ role }: { role: UserRole }) {
  const xray = useXray(Number(useParams().xrayId));
  return <div className="xray-page"><PageHeader eyebrow={`${role.toLowerCase()} workspace`} title="X-ray Details" description="Protected image and AI information remain available only through authenticated API access." />{xray.isLoading ? <LoadingState title="Loading X-ray..." /> : null}{xray.isError ? <ErrorState error={xray.error} title="X-ray unavailable" onRetry={() => void xray.refetch()} /> : null}{xray.data ? <XrayDetail role={role} xray={xray.data} /> : null}</div>;
}
