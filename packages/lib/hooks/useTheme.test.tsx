import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const embed = vi.hoisted(() => ({ theme: null as string | null }));
vi.mock("@calcom/embed-core/embed-iframe", () => ({
  useEmbedTheme: () => embed.theme,
}));

import useTheme, { useGetTheme } from "./useTheme";

function Probe({ theme }: { theme: string | null | undefined }) {
  useTheme(theme);
  const { activeTheme, resolvedTheme } = useGetTheme();
  return (
    <span data-testid="theme">
      {activeTheme}/{resolvedTheme}
    </span>
  );
}

function renderWithProvider(theme: string | null | undefined) {
  return render(
    <ThemeProvider attribute="class" enableSystem defaultTheme="system">
      <Probe theme={theme} />
    </ThemeProvider>
  );
}

// jsdom under this node version exposes no window.localStorage, so an in-memory Storage stands in.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe("useTheme", () => {
  beforeEach(() => {
    embed.theme = null;
    Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
    document.documentElement.className = "";
  });

  afterEach(() => {
    document.documentElement.className = "";
  });

  it("applies the requested theme to the document through next-themes", () => {
    renderWithProvider("dark");

    expect(screen.getByTestId("theme")).toHaveTextContent("dark/dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("uses the theme remembered in localStorage when none is passed", () => {
    window.localStorage.setItem("app-theme", "light");

    renderWithProvider(null);

    expect(screen.getByTestId("theme")).toHaveTextContent("light/light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("lets an embed theme override the booking page theme", () => {
    embed.theme = "light";

    renderWithProvider("dark");

    expect(screen.getByTestId("theme")).toHaveTextContent("light/light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("treats an embed theme of auto as the system theme", () => {
    embed.theme = "auto";

    renderWithProvider("dark");

    expect(screen.getByTestId("theme")).toHaveTextContent(/^system\//);
  });

  it("only reads the theme when getOnly is set", () => {
    function ReadOnly() {
      const theme = useTheme("dark", true);
      return <span data-testid="read">{String(theme?.activeTheme)}</span>;
    }
    render(
      <ThemeProvider attribute="class" enableSystem defaultTheme="system">
        <ReadOnly />
      </ThemeProvider>
    );

    expect(screen.getByTestId("read")).toHaveTextContent("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
