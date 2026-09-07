import { useEffect, useState } from "react";
import api from "./axios";
import { AuthContext } from "./authContextStore";
import {
  clearStoredUserId,
  getStoredUserId,
  setStoredUserId,
} from "./localNotesStore";
import { startSyncForUser, stopSyncForUser } from "./syncEngine";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    try {
      await api.post("/auth/logout");
    } finally {
      if (userId) stopSyncForUser(userId);
      setUser(null);
      clearStoredUserId();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
