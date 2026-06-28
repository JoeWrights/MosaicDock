import { useNavigate } from "react-router-dom";
import { RoutePath } from "../constants/routes";
import BasicLayout from "../layouts/BasicLayout";
import ProtectedLayout from "../layouts/ProtectedLayout";
import LoginPage from "../pages/login";
import pageRoutes from "./routes";
import type { AppRoute } from "./make-route";

function LoginRoute() {
  const navigate = useNavigate();

  return <LoginPage onAuthenticated={() => navigate(RoutePath.NEW_SESSION, { replace: true })} />;
}

const routes: AppRoute[] = [
  {
    path: RoutePath.ROOT,
    Component: BasicLayout,
    children: [
      {
        path: RoutePath.LOGIN,
        Component: LoginRoute,
      },
      {
        path: RoutePath.ROOT,
        Component: ProtectedLayout,
        children: pageRoutes,
      },
    ],
  },
];

export default routes;
