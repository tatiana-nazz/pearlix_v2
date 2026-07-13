import { useParams } from "react-router-dom";

import { Button, PageHeaderV2, StatePanel } from "../../components/v2";
import { XrayDetail } from "../../features/xrays/components/XrayDetail";
import { useXray } from "../../features/xrays/hooks/useXrays";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";

export function XrayDetailPage({ role }: { role: UserRole }) {
  const t = useFeatureT();
  const xray = useXray(Number(useParams().xrayId));
  return <div className="xray-page"><PageHeaderV2 title={t("xrayDetails")} description={t("xrayDetailsDescription")} />{xray.isLoading ? <StatePanel state="loading" title={t("loadingXrays")} /> : null}{xray.isError ? <StatePanel state="error" title={t("xrayUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void xray.refetch()}>{t("retry")}</Button>} /> : null}{xray.data ? <XrayDetail role={role} xray={xray.data} /> : null}</div>;
}
