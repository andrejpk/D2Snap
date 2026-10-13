import { webDarkTheme, webLightTheme } from "@fluentui/react-components";
import type { Theme } from "@fluentui/react-components";

/** Browser-local Clawpilot token bridge; no harness/server module is imported. */
export function createClawpilotTheme(dark: boolean): Theme {
  return {
    ...(dark ? webDarkTheme : webLightTheme),
    fontFamilyBase: '"Segoe UI", Aptos, Calibri, sans-serif',
    colorNeutralBackground1: "var(--cp-surface)",
    colorNeutralBackground2: "var(--cp-surface-soft)",
    colorNeutralBackground3: "var(--cp-bg-elevated)",
    colorNeutralForeground1: "var(--cp-text)",
    colorNeutralForeground2: "var(--cp-text-muted)",
    colorNeutralForeground3: "var(--cp-text-soft)",
    colorNeutralStroke1: "var(--cp-border)",
    colorNeutralStrokeAccessible: "var(--cp-border-strong)",
    colorBrandBackground: "var(--cp-accent)",
    colorBrandBackgroundHover: "var(--cp-accent-hover)",
    colorBrandBackgroundPressed: "var(--cp-accent-hover)",
    colorBrandBackgroundSelected: "var(--cp-accent-hover)",
    colorBrandBackground2: "var(--cp-accent-soft)",
    colorBrandForeground1: "var(--cp-accent)",
    colorBrandForeground2: "var(--cp-accent)",
    colorBrandForegroundLink: "var(--cp-link)",
    colorNeutralForegroundOnBrand: "var(--cp-accent-fg)",
    colorCompoundBrandBackground: "var(--cp-accent)",
    colorCompoundBrandBackgroundHover: "var(--cp-accent-hover)",
    colorCompoundBrandBackgroundPressed: "var(--cp-accent-hover)",
    colorCompoundBrandForeground1: "var(--cp-accent)",
    colorCompoundBrandStroke: "var(--cp-accent)",
    colorStrokeFocus2: "var(--cp-accent)",
    borderRadiusMedium: "4px",
  };
}
