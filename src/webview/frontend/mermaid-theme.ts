import type { MermaidConfig } from "mermaid";
import type { MermaidThemePreset, Theme } from "../../types/index.js";

/** 读取当前 Reader 主题对应的 CSS 变量。 */
function readCssVariable(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** 由 Reader CSS 变量生成 Mermaid 自动主题。 */
export function createAutoMermaidConfig(theme: Theme): MermaidConfig {
  const dark = theme === "dark";
  const background = readCssVariable("--bg-primary", dark ? "#1e1e2e" : "#ffffff");
  const secondaryBackground = readCssVariable(
    "--bg-secondary",
    dark ? "#2a2a3e" : "#f8f9fa",
  );
  const text = readCssVariable("--text-primary", dark ? "#cdd6f4" : "#1a1a2e");
  const secondaryText = readCssVariable(
    "--text-secondary",
    dark ? "#7f849c" : "#6c757d",
  );
  const border = readCssVariable("--border-color", dark ? "#45475a" : "#dee2e6");
  const accent = readCssVariable("--accent-color", dark ? "#89b4fa" : "#0d6efd");
  const fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";

  return {
    theme: "base",
    themeVariables: {
      darkMode: dark,
      background,
      primaryColor: secondaryBackground,
      primaryTextColor: text,
      primaryBorderColor: accent,
      lineColor: secondaryText,
      secondaryColor: border,
      tertiaryColor: background,
      nodeBkg: secondaryBackground,
      nodeBorder: accent,
      nodeTextColor: text,
      mainBkg: background,
      textColor: text,
      clusterBkg: secondaryBackground,
      clusterBorder: border,
      edgeLabelBackground: background,
      fontFamily,
    },
    securityLevel: "loose",
    startOnLoad: false,
  };
}

/** 将预设映射为 Mermaid 配置。 */
export function createMermaidConfig(
  preset: MermaidThemePreset,
  theme: Theme,
): MermaidConfig {
  if (preset === "auto") {
    return createAutoMermaidConfig(theme);
  }

  if (preset === "handDrawn") {
    return {
      ...createAutoMermaidConfig(theme),
      theme: "base",
      look: "handDrawn",
      handDrawnSeed: 7,
    };
  }

  const dark = theme === "dark";
  const presets: Record<Exclude<MermaidThemePreset, "auto" | "handDrawn">, MermaidConfig["themeVariables"]> = {
    classic: dark
      ? {
          background: "#1e1e2e",
          primaryColor: "#313244",
          primaryTextColor: "#cdd6f4",
          primaryBorderColor: "#89b4fa",
          lineColor: "#7f849c",
          secondaryColor: "#45475a",
          tertiaryColor: "#2a2a3e",
        }
      : {
          background: "#ffffff",
          primaryColor: "#e3f2fd",
          primaryTextColor: "#1a1a2e",
          primaryBorderColor: "#0d6efd",
          lineColor: "#6c757d",
          secondaryColor: "#f8f9fa",
          tertiaryColor: "#ffffff",
        },
    neutral: dark
      ? {
          background: "#202020",
          primaryColor: "#3a3a3a",
          primaryTextColor: "#eeeeee",
          primaryBorderColor: "#aaaaaa",
          lineColor: "#aaaaaa",
          secondaryColor: "#303030",
          tertiaryColor: "#252525",
        }
      : {
          background: "#ffffff",
          primaryColor: "#f3f3f3",
          primaryTextColor: "#333333",
          primaryBorderColor: "#777777",
          lineColor: "#666666",
          secondaryColor: "#fafafa",
          tertiaryColor: "#ffffff",
        },
    forest: dark
      ? {
          background: "#1f2a24",
          primaryColor: "#304d3b",
          primaryTextColor: "#e4f2e8",
          primaryBorderColor: "#7fbbb3",
          lineColor: "#a7c7ad",
          secondaryColor: "#385847",
          tertiaryColor: "#26382d",
        }
      : {
          background: "#fbfdf9",
          primaryColor: "#e6f4ea",
          primaryTextColor: "#23452e",
          primaryBorderColor: "#3a94c5",
          lineColor: "#5c6a72",
          secondaryColor: "#f3ead3",
          tertiaryColor: "#fffbef",
        },
    monochrome: dark
      ? {
          background: "#181818",
          primaryColor: "#303030",
          primaryTextColor: "#f0f0f0",
          primaryBorderColor: "#b0b0b0",
          lineColor: "#a0a0a0",
          secondaryColor: "#404040",
          tertiaryColor: "#242424",
        }
      : {
          background: "#ffffff",
          primaryColor: "#eeeeee",
          primaryTextColor: "#222222",
          primaryBorderColor: "#555555",
          lineColor: "#666666",
          secondaryColor: "#f6f6f6",
          tertiaryColor: "#ffffff",
        },
  };

  return {
    ...createAutoMermaidConfig(theme),
    theme: "base",
    themeVariables: {
      ...presets[preset],
      fontFamily: "var(--hb-font-family, sans-serif)",
    },
  };
}
