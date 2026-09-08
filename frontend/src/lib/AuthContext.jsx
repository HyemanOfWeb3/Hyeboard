import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import api from "./axios";
import { AuthContext } from "./authContextStore";
import {
  clearStoredUserId,
  getStoredUserId,
  setStoredUserId,
} from "./localNotesStore";
import { startSyncForUser, stopSyncForUser } from "./syncEngine";

export function AuthProvider({ children }) {
  const location = useLocation();
  const initialPath = useRef(location.pathname);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(
    () => !["/login", "/signup"].includes(location.pathname),
  );

  useEffect(() => {
    if (["/login", "/signup"].includes(initialPath.current)) {
      return undefined;
    }
    const activeUserId = getStoredUserId();

    api
      .get("/auth/me")
      .then((response) => {
        const nextUser = response.data.user;
        setUser(nextUser);
        const nextUserId = nextUser?.id || nextUser?._id;
        if (nextUserId) {
          setStoredUserId(nextUserId);
        }
      })
      .catch(() => {
        setUser(null);
        clearStoredUserId();
      })
      .finally(() => setLoading(false));

    if (activeUserId) {
      setStoredUserId(activeUserId);
    }
  }, []);

  useEffect(() => {
    const userId = user?.id || user?._id;
    if (userId) startSyncForUser(userId);
    return () => {
      if (userId) stopSyncForUser(userId);
    };
  }, [user]);

  const logout = async () => {
    const userId = user?.id || user?._id;
    if (userId) stopSyncForUser(userId);
    setUser(null);
    clearStoredUserId();
    try {
      await api.post("/auth/logout");
    } catch {
      // Local session state is cleared even if the network is unavailable.
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
