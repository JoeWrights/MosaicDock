import type { ComponentType, ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

export interface AppRoute {
  path?: string;
  index?: boolean;
  Component?: ComponentType;
  element?: ReactNode;
  redirect?: string;
  children?: AppRoute[];
}

export function makeRoute(route: AppRoute): RouteObject {
  const { path, index, Component, element: routeElement, redirect, children } = route;

  let element = routeElement ?? null;
  if (redirect) {
    element = <Navigate replace to={redirect} />;
  } else if (Component) {
    element = <Component />;
  }

  if (index) {
    return {
      index: true,
      element,
    };
  }

  return {
    path,
    element,
    children: children?.map((child) => makeRoute(child)),
  };
}
