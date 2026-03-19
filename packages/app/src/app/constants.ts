import type { ModelRef, SuggestedPlugin } from "./types";
import { t, currentLocale } from "../i18n";

export const MODEL_PREF_KEY = "openwork.defaultModel";
export const SESSION_MODEL_PREF_KEY = "openwork.sessionModels";
export const THINKING_PREF_KEY = "openwork.showThinking";
export const VARIANT_PREF_KEY = "openwork.modelVariant";
export const LANGUAGE_PREF_KEY = "openwork.language";
export const HIDE_TITLEBAR_PREF_KEY = "openwork.hideTitlebar";
export const AUTO_COMPACT_CONTEXT_PREF_KEY = "openwork.autoCompactContext";

export const DEFAULT_MODEL: ModelRef = {
  providerID: "opencode",
  modelID: "big-pickle",
};

export const SUGGESTED_PLUGINS: SuggestedPlugin[] = [
  {
    name: "opencode-scheduler",
    packageName: "opencode-scheduler",
    get description() {
      return t("mcp_desc.scheduler", currentLocale());
    },
    tags: ["automation", "jobs"],
    installMode: "simple",
  },
];

export type McpDirectoryInfo = {
  id?: string;
  name: string;
  description: string;
  url?: string;
  type?: "remote" | "local";
  command?: string[];
  oauth: boolean;
};

export const MCP_QUICK_CONNECT: McpDirectoryInfo[] = [
  {
    name: "Notion",
    get description() {
      return t("mcp_desc.notion", currentLocale());
    },
    url: "https://mcp.notion.com/mcp",
    type: "remote",
    oauth: true,
  },
  {
    name: "Linear",
    get description() {
      return t("mcp_desc.linear", currentLocale());
    },
    url: "https://mcp.linear.app/mcp",
    type: "remote",
    oauth: true,
  },
  {
    name: "Sentry",
    get description() {
      return t("mcp_desc.sentry", currentLocale());
    },
    url: "https://mcp.sentry.dev/mcp",
    type: "remote",
    oauth: true,
  },
  {
    name: "Stripe",
    get description() {
      return t("mcp_desc.stripe", currentLocale());
    },
    url: "https://mcp.stripe.com",
    type: "remote",
    oauth: true,
  },
  {
    name: "Context7",
    get description() {
      return t("mcp_desc.context7", currentLocale());
    },
    url: "https://mcp.context7.com/mcp",
    type: "remote",
    oauth: false,
  },
  {
    id: "chrome-devtools",
    get name() {
      return t("mcp_desc.chrome_title", currentLocale());
    },
    get description() {
      return t("mcp_desc.chrome_desc", currentLocale());
    },
    type: "local",
    command: ["npx", "-y", "chrome-devtools-mcp@latest"],
    oauth: false,
  },
];
