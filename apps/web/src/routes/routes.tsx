import { RoutePath } from "../constants/routes";
import WorkspaceLayout from "../layouts/WorkspaceLayout";
import BotsManagementPage from "../pages/bots/management";
import CharactersPage from "../pages/characters";
import ChatWorkspace from "../pages/chat";
import KnowledgeBasePage from "../pages/knowledge-base";
import ModelsPage from "../pages/models";
import NewSessionPage from "../pages/new-session";
import PluginsPage from "../pages/plugins";
import SchedulerPage from "../pages/scheduler";
import SettingsPage from "../pages/settings";
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
        path: RoutePath.CHARACTERS,
        redirect: RoutePath.CHARACTERS_ASSISTANTS,
      },
      {
        path: `${RoutePath.CHARACTERS}/:tab`,
        Component: CharactersPage,
      },
      {
        path: RoutePath.PLUGINS,
        redirect: RoutePath.PLUGINS_LOCAL_TOOLS,
      },
      {
        path: `${RoutePath.PLUGINS}/:tab`,
        Component: PluginsPage,
      },
      {
        path: RoutePath.BOTS_MANAGEMENT,
        Component: BotsManagementPage,
      },
      {
        path: RoutePath.KNOWLEDGE_BASE,
        Component: KnowledgeBasePage,
      },
      {
        path: RoutePath.CHAT,
        Component: ChatWorkspace,
      },
      {
        path: RoutePath.SCHEDULER,
        Component: SchedulerPage,
      },
      {
        path: RoutePath.MODELS,
        Component: ModelsPage,
      },
      {
        path: RoutePath.SETTING,
        redirect: RoutePath.SETTING_GENERAL,
      },
      {
        path: `${RoutePath.SETTING}/:tab`,
        Component: SettingsPage,
      },
      {
        path: `${RoutePath.CHAT}/new-session`,
        Component: NewSessionPage,
      },
      {
        path: `${RoutePath.CHAT}/:sessionId`,
        Component: ChatWorkspace,
      },
    ],
  },
];

export default pageRoutes;
