import { useEffect, useState } from "react";

export const ONLINE_STATUS = Object.freeze({
  online: "online",
  offline: "offline",
  reconnecting: "reconnecting",
});

export function useOnlineStatus() {
  const [status, setStatus] = useState(() =>
    navigator.onLine ? ONLINE_STATUS.online : ONLINE_STATUS.offline,
  );

  useEffect(() => {
    const handleOnline = () => {
      setStatus(ONLINE_STATUS.reconnecting);
      window.setTimeout(() => setStatus(ONLINE_STATUS.online), 500);
    };

    const handleOffline = () => {
      setStatus(ONLINE_STATUS.offline);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    status,
    isOnline: status === ONLINE_STATUS.online,
    isOffline:
      status === ONLINE_STATUS.offline || status === ONLINE_STATUS.reconnecting,
  };
}
