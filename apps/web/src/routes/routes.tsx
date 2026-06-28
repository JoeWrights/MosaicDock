import { RoutePath } from "../constants/routes";
import WorkspaceLayout from "../layouts/WorkspaceLayout";
import ChatWorkspace from "../pages/chat";
import NewSessionPage from "../pages/new-session";
import type { AppRoute } from "./make-route";

const pageRoutes: AppRoute[] = [
  {
    path: RoutePath.ROOT,
    Component: WorkspaceLayout,
    children: [
      {
        index: true,
        redirect: RoutePath.NEW_SESSION,
      },
      {
        path: RoutePath.NEW_SESSION,
        Component: NewSessionPage,
      },
      {
        path: RoutePath.CHAT,
        Component: ChatWorkspace,
      },
    ],
  },
];

export default pageRoutes;
