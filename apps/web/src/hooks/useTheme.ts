import { useEffect, useState } from "react";

const colorSchemeKey = "color-scheme";

function getInitialDarkMode(): boolean {
  if (typeof window === "undefined") return false;

  const savedTheme = localStorage.getItem(colorSchemeKey);
  if (savedTheme === "dark") return true;
  if (savedTheme === "light") return false;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function useTheme() {
  const [isDark, setIsDark] = useState(getInitialDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(colorSchemeKey, isDark ? "dark" : "light");
  }, [isDark]);

  function toggleDark() {
    setIsDark((current) => !current);
  }

  return { isDark, toggleDark };
}
