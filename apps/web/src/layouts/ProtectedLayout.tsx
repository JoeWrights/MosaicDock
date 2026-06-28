import { Outlet } from "react-router-dom";
import { AuthGate } from "../components/auth/AuthGate";

export function ProtectedLayout() {
  return (
    <AuthGate>
      <Outlet />
    </AuthGate>
  );
}

export default ProtectedLayout;
