import { useMemo } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import routes from "./routes";
import { makeRoute } from "./routes/make-route";
import "./styles.css";

function createAppRouter() {
  return createBrowserRouter(routes.map((route) => makeRoute(route)));
}

export function App() {
  const router = useMemo(() => createAppRouter(), []);

  return <RouterProvider router={router} />;
}
