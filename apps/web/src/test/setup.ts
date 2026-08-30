import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
