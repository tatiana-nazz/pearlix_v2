import { useSearchParams } from "react-router-dom";

import { Button, PageHeaderV2, StatePanel } from "../../components/v2";
import { XrayList } from "../../features/xrays/components/XrayList";
import { useXrays } from "../../features/xrays/hooks/useXrays";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";

export function XrayListPage({ role }: { role: UserRole }) {
  const t = useFeatureT(); const [searchParams, setSearchParams] = useSearchParams(); const page = Number(searchParams.get("page") || "1"); const xrays = useXrays({ page });
  function setPage(next: number) { const params = new URLSearchParams(searchParams); params.set("page", String(next)); setSearchParams(params); }
  return <div className="xray-page"><PageHeaderV2 title={t("savedXrays")} description={t("savedXraysDescription")} />
    {xrays.isLoading ? <StatePanel state="loading" title={t("loadingXrays")} /> : null}{xrays.isError ? <StatePanel state="error" title={t("xrayUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void xrays.refetch()}>{t("retry")}</Button>} /> : null}
    {xrays.data ? <><XrayList role={role} xrays={xrays.data.results} /><div className="pagination-bar"><span>{xrays.data.count} {t("records")}</span><div><Button compact variant="secondary" disabled={!xrays.data.previous || page <= 1} onClick={() => setPage(page - 1)}>{t("previous")}</Button><span className="bidi-isolate">{t("page")} {page}</span><Button compact variant="secondary" disabled={!xrays.data.next} onClick={() => setPage(page + 1)}>{t("next")}</Button></div></div></> : null}
  </div>;
}
