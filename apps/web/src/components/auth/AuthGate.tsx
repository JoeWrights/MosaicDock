import { useEffect, useState, type ReactNode } from "react";
import { mosaicApi, type ApiClient } from "@mosaic-dock/api-client";
import type { User } from "@mosaic-dock/shared";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "../ui/spinner";

interface AuthGateApi {
  client: Pick<ApiClient, "getProfile" | "login">;
}

interface AuthGateProps {
  api?: AuthGateApi;
  children: ReactNode;
}

export function AuthGate({ api = mosaicApi, children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    api.client
      .getProfile()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!checked) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center">
        <Spinner label="正在检查登录状态..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate replace to="/login" state={{ from: location }} />;
  }

  return children;
}
