import { useContext, useEffect } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";

const defaultMessage = "You have unsaved changes. Leave this page and discard them?";

export function useUnsavedChanges(dirty: boolean, message = defaultMessage) {
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  // Production uses createBrowserRouter. Keeping the hook usable without a
  // data router also lets isolated forms retain beforeunload protection.
  const blocker = dataRouter ? useBlocker(dirty) : null;

  useEffect(() => {
    if (!blocker || blocker.state !== "blocked") return;
    if (window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker, message]);

  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
}
