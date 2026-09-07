import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { useSyncStatus } from "../lib/useSyncStatus";

const OfflineStatus = () => {
  const { status, isOnline } = useOnlineStatus();
  const syncStatus = useSyncStatus();
  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleOnline = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      setShowBackOnline(true);
      timerRef.current = window.setTimeout(() => setShowBackOnline(false), 1800);
    };

    const handleOffline = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      setShowBackOnline(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (status === "offline") {
    return (
      <div
        className="status-banner status-banner--offline"
        role="status"
        aria-live="polite"
      >
        <WifiOff size={15} />
        <div className="status-banner__content">
          <strong>You&apos;re offline</strong>
          <small>Local notes remain available.</small>
        </div>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div
        className="status-banner status-banner--reconnecting"
        role="status"
        aria-live="polite"
      >
        <RefreshCw size={15} className="spin" />
        <span>Reconnecting…</span>
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div
        className="status-banner status-banner--online"
        role="status"
        aria-live="polite"
      >
        <Wifi size={15} />
        <span>Back online</span>
      </div>
    );
  }

  if (syncStatus.status === "syncing") {
    return (
      <div className="status-banner status-banner--reconnecting" role="status" aria-live="polite">
        <RefreshCw size={15} className="spin" />
        <span>Syncing…</span>
      </div>
    );
  }

  if (syncStatus.status === "conflict" || syncStatus.status === "auth-required") {
    return (
      <div className="status-banner status-banner--offline" role="status" aria-live="polite">
        <WifiOff size={15} />
        <span>{syncStatus.status === "conflict" ? "Sync issue: review a note" : "Sign in to sync changes"}</span>
      </div>
    );
  }

  if (syncStatus.status === "error") {
    return (
      <div className="status-banner status-banner--offline" role="status" aria-live="polite">
        <RefreshCw size={15} />
        <span>Sync issue · retrying</span>
      </div>
    );
  }

  if (needRefresh) {
    return (
      <div
        className="status-banner status-banner--update"
        role="status"
        aria-live="polite"
      >
        <Download size={15} />
        <span>New version available</span>
        <button
          className="text-button inline-text-button"
          onClick={() => updateServiceWorker(true)}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (installPrompt && isOnline) {
    return (
      <div
        className="status-banner status-banner--install"
        role="status"
        aria-live="polite"
      >
        <Wifi size={15} />
        <span>Install HyeBoard</span>
        <button
          className="text-button inline-text-button"
          onClick={handleInstall}
        >
          Install
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div
        className="status-banner status-banner--ready"
        role="status"
        aria-live="polite"
      >
        <Wifi size={15} />
        <span>Offline-ready</span>
      </div>
    );
  }

  return null;
};

export default OfflineStatus;
