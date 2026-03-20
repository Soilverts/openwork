import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onMount } from "solid-js";

import { formatBytes, formatRelativeTime, isTauriRuntime, isWindowsPlatform } from "../utils";

import Button from "../components/button";
import { usePlatform } from "../context/platform";
import { FEEDBACK_EMAIL_URL } from "../lib/feedback";
import {
  ArrowUpRight,
  CircleAlert,
  Copy,
  Cpu,
  Download,
  FolderOpen,
  HardDrive,
  LifeBuoy,
  MessageCircle,
  PlugZap,
  RefreshCcw,
  Server,
  Smartphone,
  X,
  Zap,
} from "lucide-solid";
import type { OpencodeConnectStatus, ProviderListItem, SettingsTab, StartupPreference } from "../types";
import type {
  OpenworkAuditEntry,
  OpenworkServerCapabilities,
  OpenworkServerDiagnostics,
  OpenworkServerSettings,
  OpenworkServerStatus,
} from "../lib/openwork-server";
import type {
  EngineInfo,
  OrchestratorBinaryInfo,
  OrchestratorStatus,
  OpenworkServerInfo,
  AppBuildInfo,
  OpenCodeRouterInfo,
  SandboxDebugProbeResult,
} from "../lib/tauri";
import {
  appBuildInfo,
  engineRestart,
  nukeOpencodeDevConfigAndExit,
  opencodeRouterRestart,
  opencodeRouterStop,
  openworkServerRestart,
  pickFile,
  sandboxDebugProbe,
} from "../lib/tauri";
import { currentLocale, LANGUAGE_OPTIONS, t, type Language } from "../../i18n";

export type SettingsViewProps = {
  startupPreference: StartupPreference | null;
  baseUrl: string;
  headerStatus: string;
  busy: boolean;
  clientConnected: boolean;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  providers: ProviderListItem[];
  providerConnectedIds: string[];
  providerAuthBusy: boolean;
  openProviderAuthModal: () => Promise<void>;
  disconnectProvider: (providerId: string) => Promise<string | void>;
  openworkServerStatus: OpenworkServerStatus;
  openworkServerUrl: string;
  openworkReconnectBusy: boolean;
  reconnectOpenworkServer: () => Promise<boolean>;
  openworkServerHostInfo: OpenworkServerInfo | null;
  openworkServerCapabilities: OpenworkServerCapabilities | null;
  openworkServerDiagnostics: OpenworkServerDiagnostics | null;
  openworkServerWorkspaceId: string | null;
  activeWorkspaceRoot: string;
  openworkAuditEntries: OpenworkAuditEntry[];
  openworkAuditStatus: "idle" | "loading" | "error";
  openworkAuditError: string | null;
  opencodeConnectStatus: OpencodeConnectStatus | null;
  engineInfo: EngineInfo | null;
  orchestratorStatus: OrchestratorStatus | null;
  opencodeRouterInfo: OpenCodeRouterInfo | null;
  developerMode: boolean;
  toggleDeveloperMode: () => void;
  stopHost: () => void;
  restartLocalServer: () => Promise<boolean>;
  engineSource: "path" | "sidecar" | "custom";
  setEngineSource: (value: "path" | "sidecar" | "custom") => void;
  engineCustomBinPath: string;
  setEngineCustomBinPath: (value: string) => void;
  engineRuntime: "direct" | "openwork-orchestrator";
  setEngineRuntime: (value: "direct" | "openwork-orchestrator") => void;
  isWindows: boolean;
  defaultModelLabel: string;
  defaultModelRef: string;
  openDefaultModelPicker: () => void;
  showThinking: boolean;
  toggleShowThinking: () => void;
  autoCompactContext: boolean;
  toggleAutoCompactContext: () => void;
  hideTitlebar: boolean;
  toggleHideTitlebar: () => void;
  modelVariantLabel: string;
  editModelVariant: () => void;
  language: Language;
  setLanguage: (value: Language) => void;
  themeMode: "light" | "dark" | "system";
  setThemeMode: (value: "light" | "dark" | "system") => void;
  updateAutoCheck: boolean;
  toggleUpdateAutoCheck: () => void;
  updateAutoDownload: boolean;
  toggleUpdateAutoDownload: () => void;
  updateStatus: {
    state: string;
    lastCheckedAt?: number | null;
    version?: string;
    date?: string;
    notes?: string;
    totalBytes?: number | null;
    downloadedBytes?: number;
    message?: string;
  } | null;
  updateEnv: { supported?: boolean; reason?: string | null } | null;
  appVersion: string | null;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdateAndRestart: () => void;
  anyActiveRuns: boolean;
  onResetStartupPreference: () => void;
  openResetModal: (mode: "onboarding" | "all") => void;
  resetModalBusy: boolean;
  pendingPermissions: unknown;
  events: unknown;
  workspaceDebugEvents: unknown;
  sandboxCreateProgress: unknown;
  sandboxCreateProgressLast: unknown;
  clearWorkspaceDebugEvents: () => void;
  safeStringify: (value: unknown) => string;
  repairOpencodeMigration: () => void;
  migrationRepairBusy: boolean;
  migrationRepairResult: { ok: boolean; message: string } | null;
  migrationRepairAvailable: boolean;
  migrationRepairUnavailableReason: string | null;
  repairOpencodeCache: () => void;
  cacheRepairBusy: boolean;
  cacheRepairResult: string | null;
  cleanupOpenworkDockerContainers: () => void;
  dockerCleanupBusy: boolean;
  dockerCleanupResult: string | null;
  resetAppConfigDefaults: () => Promise<{ ok: boolean; message: string }>;
  notionStatus: "disconnected" | "connecting" | "connected" | "error";
  notionStatusDetail: string | null;
  notionError: string | null;
  notionBusy: boolean;
  connectNotion: () => void;
  engineDoctorVersion: string | null;
  openDebugShareLink: (rawUrl: string) => Promise<{ ok: boolean; message: string }>;
};

const DISCORD_INVITE_URL = "https://discord.gg/VEhNQXxYMB";
const BUG_REPORT_URL = "https://github.com/different-ai/openwork/issues/new?template=bug.yml";

// OpenCodeRouter Settings Component
//
// Messaging identities + routing are managed in the Identities tab.
export function OpenCodeRouterSettings(_props: {
  busy: boolean;
  openworkServerStatus: OpenworkServerStatus;
  openworkServerUrl: string;
  openworkServerSettings: OpenworkServerSettings;
  openworkServerWorkspaceId: string | null;
  openworkServerHostInfo: OpenworkServerInfo | null;
  developerMode: boolean;
}) {
  return (
    <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-2">
      <div class="flex items-center gap-2">
        <MessageCircle size={16} class="text-gray-11" />
        <div class="text-sm font-medium text-gray-12">{t("settings.messaging_title", currentLocale())}</div>
      </div>
      <div class="text-xs text-gray-10">
        {t("settings.messaging_hint", currentLocale())}
      </div>
    </div>
  );
}


export default function SettingsView(props: SettingsViewProps) {
  const platform = usePlatform();
  const translate = (key: string) => t(key, currentLocale());
  const engineCustomBinPathLabel = () => props.engineCustomBinPath.trim() || translate("settings.no_binary_selected");

  const openExternalLink = (url: string) => {
    const resolved = url.trim();
    if (!resolved) return;
    platform.openLink(resolved);
  };

  const handlePickEngineBinary = async () => {
    if (!isTauriRuntime()) return;
    try {
      const selected = await pickFile({ title: translate("settings.select_opencode_binary") });
      const path = Array.isArray(selected) ? selected[0] : selected;
      const trimmed = (path ?? "").trim();
      if (!trimmed) return;
      props.setEngineCustomBinPath(trimmed);
      props.setEngineSource("custom");
    } catch {
      // ignore
    }
  };
  const [buildInfo, setBuildInfo] = createSignal<AppBuildInfo | null>(null);
  const updateState = () => props.updateStatus?.state ?? "idle";
  const updateNotes = () => props.updateStatus?.notes ?? null;
  const updateVersion = () => props.updateStatus?.version ?? null;
  const updateDate = () => props.updateStatus?.date ?? null;
  const updateLastCheckedAt = () => props.updateStatus?.lastCheckedAt ?? null;
  const updateDownloadedBytes = () => props.updateStatus?.downloadedBytes ?? null;
  const updateTotalBytes = () => props.updateStatus?.totalBytes ?? null;
  const updateErrorMessage = () => props.updateStatus?.message ?? null;

  const updateDownloadPercent = createMemo<number | null>(() => {
    const total = updateTotalBytes();
    if (total == null || total <= 0) return null;
    const downloaded = updateDownloadedBytes() ?? 0;
    const clamped = Math.max(0, Math.min(1, downloaded / total));
    return Math.floor(clamped * 100);
  });

  const isMacToolbar = createMemo(() => {
    if (props.isWindows) return false;
    if (typeof navigator === "undefined") return false;
    const platform =
      typeof (navigator as any).userAgentData?.platform === "string"
        ? (navigator as any).userAgentData.platform
        : typeof navigator.platform === "string"
          ? navigator.platform
          : "";
    const ua = typeof navigator.userAgent === "string" ? navigator.userAgent : "";
    return /mac/i.test(platform) || /mac/i.test(ua);
  });

  const showUpdateToolbar = createMemo(() => {
    if (!isTauriRuntime()) return false;
    if (props.updateEnv && props.updateEnv.supported === false) return false;
    return isMacToolbar();
  });

  const updateToolbarTone = createMemo(() => {
    switch (updateState()) {
      case "available":
        return "bg-amber-7/10 text-amber-11 border-amber-7/20";
      case "ready":
        return "bg-green-7/10 text-green-11 border-green-7/20";
      case "error":
        return "bg-red-7/10 text-red-11 border-red-7/20";
      case "checking":
      case "downloading":
        return "bg-gray-4/60 text-gray-11 border-gray-7/50";
      default:
        return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    }
  });

  const updateToolbarSpinning = createMemo(() => updateState() === "checking" || updateState() === "downloading");

  const updateToolbarLabel = createMemo(() => {
    const state = updateState();
    const version = updateVersion();
    if (state === "available") {
      return `${translate("settings.toolbar_update_available")}${version ? ` · v${version}` : ""}`;
    }
    if (state === "ready") {
      return `${translate("settings.toolbar_ready_to_install")}${version ? ` · v${version}` : ""}`;
    }
    if (state === "downloading") {
      const downloaded = updateDownloadedBytes() ?? 0;
      const percent = updateDownloadPercent();
      if (percent != null) return `${translate("settings.toolbar_downloading")} ${percent}%`;
      return `${translate("settings.toolbar_downloading")} ${formatBytes(downloaded)}`;
    }
    if (state === "checking") {
      return translate("settings.toolbar_checking");
    }
    if (state === "error") {
      return translate("settings.toolbar_check_failed");
    }
    return translate("settings.toolbar_up_to_date");
  });

  const updateToolbarTitle = createMemo(() => {
    const state = updateState();
    const version = updateVersion();
    if (state !== "downloading") return updateToolbarLabel();

    const downloaded = updateDownloadedBytes() ?? 0;
    const total = updateTotalBytes();
    const percent = updateDownloadPercent();

    if (total != null && percent != null) {
      return `${translate("settings.toolbar_downloading")} ${formatBytes(downloaded)} / ${formatBytes(total)} (${percent}%)${version ? ` · v${version}` : ""}`;
    }

    return `${translate("settings.toolbar_downloading")} ${formatBytes(downloaded)}${version ? ` · v${version}` : ""}`;
  });

  const updateToolbarActionLabel = createMemo(() => {
    const state = updateState();
    if (state === "available") return translate("settings.toolbar_action_download");
    if (state === "ready") return translate("settings.toolbar_action_install");
    if (state === "error") return translate("settings.toolbar_action_retry");
    if (state === "idle") return translate("settings.toolbar_action_check");
    return null;
  });

  const updateToolbarDisabled = createMemo(() => {
    const state = updateState();
    if (state === "checking" || state === "downloading") return true;
    if (state === "ready" && props.anyActiveRuns) return true;
    return props.busy;
  });

  const handleUpdateToolbarAction = () => {
    if (updateToolbarDisabled()) return;
    const state = updateState();
    if (state === "available") {
      props.downloadUpdate();
      return;
    }
    if (state === "ready") {
      props.installUpdateAndRestart();
      return;
    }
    props.checkForUpdates();
  };

  const notionStatusLabel = () => {
    switch (props.notionStatus) {
      case "connected":
        return translate("settings.notion_connected");
      case "connecting":
        return translate("settings.reload_required");
      case "error":
        return translate("settings.connection_failed");
      default:
        return translate("settings.notion_not_connected");
    }
  };

  const notionStatusStyle = () => {
    if (props.notionStatus === "connected") {
      return "bg-green-7/10 text-green-11 border-green-7/20";
    }
    if (props.notionStatus === "error") {
      return "bg-red-7/10 text-red-11 border-red-7/20";
    }
    if (props.notionStatus === "connecting") {
      return "bg-amber-7/10 text-amber-11 border-amber-7/20";
    }
    return "bg-gray-4/60 text-gray-11 border-gray-7/50";
  };

  const [providerConnectError, setProviderConnectError] = createSignal<string | null>(null);
  const [providerDisconnectStatus, setProviderDisconnectStatus] = createSignal<string | null>(null);
  const [providerDisconnectError, setProviderDisconnectError] = createSignal<string | null>(null);
  const [providerDisconnectingId, setProviderDisconnectingId] = createSignal<string | null>(null);
  const [openworkReconnectStatus, setOpenworkReconnectStatus] = createSignal<string | null>(null);
  const [openworkReconnectError, setOpenworkReconnectError] = createSignal<string | null>(null);
  const [openworkRestartBusy, setOpenworkRestartBusy] = createSignal(false);
  const [openworkRestartStatus, setOpenworkRestartStatus] = createSignal<string | null>(null);
  const [openworkRestartError, setOpenworkRestartError] = createSignal<string | null>(null);
  const providerConnectedCount = createMemo(() => (props.providerConnectedIds ?? []).length);
  const providerAvailableCount = createMemo(() => (props.providers ?? []).length);
  const connectedProviders = createMemo(() => {
    const connectedIds = props.providerConnectedIds ?? [];
    if (!connectedIds.length) return [] as { id: string; name: string }[];
    const providersById = new Map((props.providers ?? []).map((provider) => [provider.id, provider]));
    return connectedIds
      .map((id) => {
        const provider = providersById.get(id);
        const label = provider?.name?.trim() || provider?.id?.trim() || id.trim();
        return { id, name: label || id };
      })
      .filter((entry) => entry.id.trim());
  });
  const providerStatusLabel = createMemo(() => {
    if (!providerAvailableCount()) return translate("settings.provider_unavailable");
    if (!providerConnectedCount()) return translate("settings.provider_not_connected");
    return `${providerConnectedCount()} ${translate("settings.provider_connected_suffix")}`;
  });
  const providerStatusStyle = createMemo(() => {
    if (!providerAvailableCount()) return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    if (!providerConnectedCount()) return "bg-amber-7/10 text-amber-11 border-amber-7/20";
    return "bg-green-7/10 text-green-11 border-green-7/20";
  });
  const providerSummary = createMemo(() => {
    if (!providerAvailableCount()) return translate("settings.provider_connect_to_load");
    const connected = providerConnectedCount();
    const available = providerAvailableCount();
    if (!connected) return `${available} ${translate("settings.provider_available_suffix")}`;
    return `${connected} ${translate("settings.provider_connected_suffix")} · ${available} ${translate("settings.provider_available_suffix")}`;
  });

  const handleOpenProviderAuth = async () => {
    if (props.busy || props.providerAuthBusy) return;
    setProviderConnectError(null);
    setProviderDisconnectError(null);
    setProviderDisconnectStatus(null);
    try {
      await props.openProviderAuthModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : translate("settings.failed_open_providers");
      setProviderConnectError(message);
    }
  };

  const handleDisconnectProvider = async (providerId: string) => {
    const resolved = providerId.trim();
    if (!resolved || props.busy || props.providerAuthBusy || providerDisconnectingId()) return;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(translate("settings.disconnect_confirm").replace("{provider}", resolved));
    if (!confirmed) return;
    setProviderDisconnectError(null);
    setProviderDisconnectStatus(null);
    setProviderDisconnectingId(resolved);
    try {
      const result = await props.disconnectProvider(resolved);
      setProviderDisconnectStatus(result || translate("settings.disconnected_provider").replace("{provider}", resolved));
    } catch (error) {
      const message = error instanceof Error ? error.message : translate("settings.failed_disconnect_provider");
      setProviderDisconnectError(message);
    } finally {
      setProviderDisconnectingId(null);
    }
  };

  const handleReconnectOpenworkServer = async () => {
    if (props.busy || props.openworkReconnectBusy) return;
    if (!props.openworkServerUrl.trim()) return;
    setOpenworkReconnectStatus(null);
    setOpenworkReconnectError(null);
    try {
      const ok = await props.reconnectOpenworkServer();
      if (!ok) {
        setOpenworkReconnectError(translate("settings.reconnect_failed"));
        return;
      }
      setOpenworkReconnectStatus(translate("settings.reconnected_server"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOpenworkReconnectError(message || translate("settings.failed_reconnect_server"));
    }
  };

  const handleRestartLocalServer = async () => {
    if (props.busy || openworkRestartBusy()) return;
    setOpenworkRestartStatus(null);
    setOpenworkRestartError(null);
    setOpenworkRestartBusy(true);
    try {
      const ok = await props.restartLocalServer();
      if (!ok) {
        setOpenworkRestartError(translate("settings.restart_failed"));
        return;
      }
      setOpenworkRestartStatus(translate("settings.restarted_local_server"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOpenworkRestartError(message || translate("settings.failed_restart_local_server"));
    } finally {
      setOpenworkRestartBusy(false);
    }
  };

  const openworkStatusLabel = createMemo(() => {
    switch (props.openworkServerStatus) {
      case "connected":
        return translate("settings.status_connected");
      case "limited":
        return translate("settings.status_limited");
      default:
        return translate("settings.status_not_connected");
    }
  });

  const openworkStatusStyle = createMemo(() => {
    switch (props.openworkServerStatus) {
      case "connected":
        return "bg-green-7/10 text-green-11 border-green-7/20";
      case "limited":
        return "bg-amber-7/10 text-amber-11 border-amber-7/20";
      default:
        return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    }
  });

  const openworkStatusDot = createMemo(() => {
    switch (props.openworkServerStatus) {
      case "connected":
        return "bg-green-9";
      case "limited":
        return "bg-amber-9";
      default:
        return "bg-gray-6";
    }
  });

  const clientStatusLabel = createMemo(() => {
    const status = props.opencodeConnectStatus?.status;
    if (status === "connecting") return translate("settings.status_connecting");
    if (status === "error") return translate("settings.status_connection_failed");
    return props.clientConnected ? translate("settings.status_connected") : translate("settings.status_not_connected");
  });

  const clientStatusStyle = createMemo(() => {
    const status = props.opencodeConnectStatus?.status;
    if (status === "connecting") return "bg-amber-7/10 text-amber-11 border-amber-7/20";
    if (status === "error") return "bg-red-7/10 text-red-11 border-red-7/20";
    return props.clientConnected
      ? "bg-green-7/10 text-green-11 border-green-7/20"
      : "bg-gray-4/60 text-gray-11 border-gray-7/50";
  });

  const clientStatusDot = createMemo(() => {
    const status = props.opencodeConnectStatus?.status;
    if (status === "connecting") return "bg-amber-9";
    if (status === "error") return "bg-red-9";
    return props.clientConnected ? "bg-green-9" : "bg-gray-6";
  });

  const engineStatusLabel = createMemo(() => {
    if (!isTauriRuntime()) return translate("settings.status_unavailable");
    return props.engineInfo?.running ? translate("settings.status_running") : translate("settings.status_offline");
  });

  const engineStatusStyle = createMemo(() => {
    if (!isTauriRuntime()) return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    return props.engineInfo?.running
      ? "bg-green-7/10 text-green-11 border-green-7/20"
      : "bg-gray-4/60 text-gray-11 border-gray-7/50";
  });

  const opencodeConnectStatusLabel = createMemo(() => {
    const status = props.opencodeConnectStatus?.status;
    if (!status) return translate("settings.status_idle");
    if (status === "connected") return translate("settings.status_connected");
    if (status === "connecting") return translate("settings.status_connecting");
    return translate("settings.status_failed");
  });

  const opencodeConnectStatusStyle = createMemo(() => {
    const status = props.opencodeConnectStatus?.status;
    if (!status) return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    if (status === "connected") return "bg-green-7/10 text-green-11 border-green-7/20";
    if (status === "connecting") return "bg-amber-7/10 text-amber-11 border-amber-7/20";
    return "bg-red-7/10 text-red-11 border-red-7/20";
  });

  const opencodeConnectTimestamp = createMemo(() => {
    const at = props.opencodeConnectStatus?.at;
    if (!at) return null;
    return formatRelativeTime(at);
  });

  const opencodeRouterStatusLabel = createMemo(() => {
    if (!isTauriRuntime()) return translate("settings.status_unavailable");
    return props.opencodeRouterInfo?.running ? translate("settings.status_running") : translate("settings.status_offline");
  });

  const opencodeRouterStatusStyle = createMemo(() => {
    if (!isTauriRuntime()) return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    return props.opencodeRouterInfo?.running
      ? "bg-green-7/10 text-green-11 border-green-7/20"
      : "bg-gray-4/60 text-gray-11 border-gray-7/50";
  });

  const [opencodeRouterRestarting, setOpenCodeRouterRestarting] = createSignal(false);
  const [opencodeRouterRestartError, setOpenCodeRouterRestartError] = createSignal<string | null>(null);
  const [openworkServerRestarting, setOpenworkServerRestarting] = createSignal(false);
  const [openworkServerRestartError, setOpenworkServerRestartError] = createSignal<string | null>(null);
  const [opencodeRestarting, setOpencodeRestarting] = createSignal(false);
  const [opencodeRestartError, setOpencodeRestartError] = createSignal<string | null>(null);

  const handleOpenCodeRouterRestart = async () => {
    if (opencodeRouterRestarting()) return;
    const workspacePath = props.opencodeRouterInfo?.workspacePath?.trim() || props.engineInfo?.projectDir?.trim();
    const opencodeUrl = props.opencodeRouterInfo?.opencodeUrl?.trim() || props.engineInfo?.baseUrl?.trim();
    const opencodeUsername = props.engineInfo?.opencodeUsername?.trim() || undefined;
    const opencodePassword = props.engineInfo?.opencodePassword?.trim() || undefined;
    if (!workspacePath) {
      setOpenCodeRouterRestartError(translate("settings.no_worker_path"));
      return;
    }
    setOpenCodeRouterRestarting(true);
    setOpenCodeRouterRestartError(null);
    try {
      await opencodeRouterRestart({
        workspacePath,
        opencodeUrl: opencodeUrl || undefined,
        opencodeUsername,
        opencodePassword,
      });
    } catch (e) {
      setOpenCodeRouterRestartError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpenCodeRouterRestarting(false);
    }
  };

  const handleOpenCodeRouterStop = async () => {
    if (opencodeRouterRestarting()) return;
    setOpenCodeRouterRestarting(true);
    setOpenCodeRouterRestartError(null);
    try {
      await opencodeRouterStop();
    } catch (e) {
      setOpenCodeRouterRestartError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpenCodeRouterRestarting(false);
    }
  };

  const handleOpenworkServerRestart = async () => {
    if (openworkServerRestarting() || !isTauriRuntime()) return;
    setOpenworkServerRestarting(true);
    setOpenworkServerRestartError(null);
    try {
      await openworkServerRestart();
      await props.reconnectOpenworkServer();
    } catch (e) {
      setOpenworkServerRestartError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpenworkServerRestarting(false);
    }
  };

  const handleOpenCodeRestart = async () => {
    if (opencodeRestarting() || !isTauriRuntime()) return;
    setOpencodeRestarting(true);
    setOpencodeRestartError(null);
    try {
      await engineRestart();
      await props.reconnectOpenworkServer();
    } catch (e) {
      setOpencodeRestartError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpencodeRestarting(false);
    }
  };

  const orchestratorStatusLabel = createMemo(() => {
    if (!props.orchestratorStatus) return translate("settings.status_unavailable");
    return props.orchestratorStatus.running ? translate("settings.status_running") : translate("settings.status_offline");
  });

  const orchestratorStatusStyle = createMemo(() => {
    if (!props.orchestratorStatus) return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    return props.orchestratorStatus.running
      ? "bg-green-7/10 text-green-11 border-green-7/20"
      : "bg-gray-4/60 text-gray-11 border-gray-7/50";
  });

  const openworkAuditStatusLabel = createMemo(() => {
    if (!props.openworkServerWorkspaceId) return translate("settings.status_unavailable");
    if (props.openworkAuditStatus === "loading") return translate("settings.status_loading");
    if (props.openworkAuditStatus === "error") return translate("settings.status_error");
    return translate("settings.status_ready");
  });

  const openworkAuditStatusStyle = createMemo(() => {
    if (!props.openworkServerWorkspaceId) return "bg-gray-4/60 text-gray-11 border-gray-7/50";
    if (props.openworkAuditStatus === "loading") return "bg-amber-7/10 text-amber-11 border-amber-7/20";
    if (props.openworkAuditStatus === "error") return "bg-red-7/10 text-red-11 border-red-7/20";
    return "bg-green-7/10 text-green-11 border-green-7/20";
  });

  const isLocalEngineRunning = createMemo(() => Boolean(props.engineInfo?.running));
  const isLocalPreference = createMemo(() => props.startupPreference === "local");
  const startupLabel = createMemo(() => {
    if (props.startupPreference === "local") return translate("settings.startup_local");
    if (props.startupPreference === "server") return translate("settings.startup_server");
    return translate("settings.startup_not_set");
  });

  const tabLabel = (tab: SettingsTab) => {
    switch (tab) {
      case "model":
        return translate("settings.tab_model");
      case "advanced":
        return translate("settings.tab_advanced");
      case "debug":
        return translate("settings.tab_debug");
      default:
        return translate("settings.tab_general");
    }
  };

  const availableTabs = createMemo<SettingsTab[]>(() => {
    const tabs: SettingsTab[] = ["general", "model", "advanced"];
    if (props.developerMode) tabs.push("debug");
    return tabs;
  });

  const activeTab = createMemo<SettingsTab>(() => {
    const tabs = availableTabs();
    return tabs.includes(props.settingsTab) ? props.settingsTab : "general";
  });

  createEffect(() => {
    if (props.settingsTab !== activeTab()) {
      props.setSettingsTab(activeTab());
    }
  });

  const formatActor = (entry: OpenworkAuditEntry) => {
    const actor = entry.actor;
    if (!actor) return "unknown";
    if (actor.type === "host") return "host";
    if (actor.type === "remote") {
      return actor.clientId ? `remote:${actor.clientId}` : "remote";
    }
    return "unknown";
  };

  const formatCapability = (cap?: { read?: boolean; write?: boolean; source?: string }) => {
    if (!cap) return translate("settings.status_unavailable");
    const parts = [cap.read ? translate("settings.cap_read") : null, cap.write ? translate("settings.cap_write") : null].filter(Boolean).join(" / ");
    const label = parts || translate("settings.cap_no_access");
    return cap.source ? `${label} · ${cap.source}` : label;
  };

  const engineStdout = () => {
    if (!isTauriRuntime()) return translate("settings.available_in_desktop");
    return props.engineInfo?.lastStdout?.trim() || translate("settings.no_stdout_yet");
  };

  const engineStderr = () => {
    if (!isTauriRuntime()) return translate("settings.available_in_desktop");
    return props.engineInfo?.lastStderr?.trim() || translate("settings.no_stderr_yet");
  };

  const openworkStdout = () => {
    if (!props.openworkServerHostInfo) return translate("settings.logs_on_host");
    return props.openworkServerHostInfo.lastStdout?.trim() || translate("settings.no_stdout_yet");
  };

  const openworkStderr = () => {
    if (!props.openworkServerHostInfo) return translate("settings.logs_on_host");
    return props.openworkServerHostInfo.lastStderr?.trim() || translate("settings.no_stderr_yet");
  };

  const opencodeRouterStdout = () => {
    if (!isTauriRuntime()) return translate("settings.available_in_desktop");
    return props.opencodeRouterInfo?.lastStdout?.trim() || translate("settings.no_stdout_yet");
  };

  const opencodeRouterStderr = () => {
    if (!isTauriRuntime()) return translate("settings.available_in_desktop");
    return props.opencodeRouterInfo?.lastStderr?.trim() || translate("settings.no_stderr_yet");
  };

  const formatOrchestratorBinary = (binary?: OrchestratorBinaryInfo | null) => {
    if (!binary) return translate("settings.binary_unavailable");
    const version = binary.actualVersion || binary.expectedVersion || "unknown";
    return `${binary.source} · ${version}`;
  };

  const formatOrchestratorBinaryVersion = (binary?: OrchestratorBinaryInfo | null) => {
    if (!binary) return "—";
    return binary.actualVersion || binary.expectedVersion || "—";
  };

  const orchestratorBinaryPath = () => props.orchestratorStatus?.binaries?.opencode?.path ?? "—";
  const orchestratorSidecarSummary = () => {
    const info = props.orchestratorStatus?.sidecar;
    if (!info) return translate("settings.sidecar_config_unavailable");
    const source = info.source ?? "auto";
    const target = info.target ?? "unknown";
    return `${source} · ${target}`;
  };

  const appVersionLabel = () => (props.appVersion ? `v${props.appVersion}` : "—");
  const appCommitLabel = () => {
    const sha = buildInfo()?.gitSha?.trim();
    if (!sha) return "—";
    return sha.length > 12 ? sha.slice(0, 12) : sha;
  };
  const opencodeVersionLabel = () => {
    const binary = props.orchestratorStatus?.binaries?.opencode ?? null;
    if (binary) return formatOrchestratorBinary(binary);
    return props.engineDoctorVersion ?? "—";
  };
  const openworkServerVersionLabel = () => props.openworkServerDiagnostics?.version ?? "—";
  const opencodeRouterVersionLabel = () => props.opencodeRouterInfo?.version ?? "—";
  const orchestratorVersionLabel = () => props.orchestratorStatus?.cliVersion ?? "—";

  onMount(() => {
    if (!isTauriRuntime()) return;
    void appBuildInfo().then((info) => setBuildInfo(info)).catch(() => setBuildInfo(null));
  });

  const formatUptime = (uptimeMs?: number | null) => {
    if (!uptimeMs) return "—";
    return formatRelativeTime(Date.now() - uptimeMs);
  };

  const [debugReportStatus, setDebugReportStatus] = createSignal<string | null>(null);
  const [configActionStatus, setConfigActionStatus] = createSignal<string | null>(null);
  const [revealConfigBusy, setRevealConfigBusy] = createSignal(false);
  const [resetConfigBusy, setResetConfigBusy] = createSignal(false);
  const [sandboxProbeBusy, setSandboxProbeBusy] = createSignal(false);
  const [sandboxProbeStatus, setSandboxProbeStatus] = createSignal<string | null>(null);
  const [sandboxProbeResult, setSandboxProbeResult] = createSignal<SandboxDebugProbeResult | null>(null);
  const [nukeDevConfigBusy, setNukeDevConfigBusy] = createSignal(false);
  const [nukeDevConfigStatus, setNukeDevConfigStatus] = createSignal<string | null>(null);
  const [debugShareLinkOpen, setDebugShareLinkOpen] = createSignal(false);
  const [debugShareLinkInput, setDebugShareLinkInput] = createSignal("");
  const [debugShareLinkBusy, setDebugShareLinkBusy] = createSignal(false);
  const [debugShareLinkStatus, setDebugShareLinkStatus] = createSignal<string | null>(null);
  const opencodeDevModeEnabled = createMemo(() => Boolean(buildInfo()?.openworkDevMode));

  const sandboxCreateSummary = createMemo(() => {
    const raw = (props.sandboxCreateProgress ?? props.sandboxCreateProgressLast) as
      | { runId?: string; stage?: string; error?: string | null; logs?: string[]; startedAt?: number }
      | null
      | undefined;
    if (!raw || typeof raw !== "object") {
      return { runId: null, stage: null, error: null, logs: [] as string[], startedAt: null };
    }
    return {
      runId: typeof raw.runId === "string" && raw.runId.trim() ? raw.runId : null,
      stage: typeof raw.stage === "string" && raw.stage.trim() ? raw.stage : null,
      error: typeof raw.error === "string" && raw.error.trim() ? raw.error : null,
      startedAt: typeof raw.startedAt === "number" ? raw.startedAt : null,
      logs: Array.isArray(raw.logs)
        ? raw.logs.filter((line) => typeof line === "string" && line.trim()).slice(-400)
        : [],
    };
  });

  const workspaceConfigPath = createMemo(() => {
    const root = props.activeWorkspaceRoot.trim();
    if (!root) return "";
    const normalized = root.replace(/[\\/]+$/, "");
    const separator = props.isWindows ? "\\" : "/";
    return `${normalized}${separator}.opencode${separator}openwork.json`;
  });

  const runtimeDebugReport = createMemo(() => ({
    generatedAt: new Date().toISOString(),
    app: {
      version: appVersionLabel(),
      commit: appCommitLabel(),
      startupPreference: props.startupPreference ?? "unset",
      workspaceRoot: props.activeWorkspaceRoot.trim() || null,
      workspaceConfigPath: workspaceConfigPath() || null,
    },
    versions: {
      orchestrator: orchestratorVersionLabel(),
      opencode: opencodeVersionLabel(),
      openworkServer: openworkServerVersionLabel(),
      opencodeRouter: opencodeRouterVersionLabel(),
    },
    services: {
      engine: {
        status: engineStatusLabel(),
        baseUrl: props.engineInfo?.baseUrl ?? null,
        pid: props.engineInfo?.pid ?? null,
        stdout: engineStdout(),
        stderr: engineStderr(),
      },
      orchestrator: {
        status: orchestratorStatusLabel(),
        dataDir: props.orchestratorStatus?.dataDir ?? null,
        activeWorkspace: props.orchestratorStatus?.activeId ?? null,
        sidecar: orchestratorSidecarSummary(),
      },
      openworkServer: {
        status: openworkStatusLabel(),
        baseUrl: (props.openworkServerHostInfo?.baseUrl ?? props.openworkServerUrl) || null,
        pid: props.openworkServerHostInfo?.pid ?? null,
        stdout: openworkStdout(),
        stderr: openworkStderr(),
      },
      opencodeRouter: {
        status: opencodeRouterStatusLabel(),
        healthPort: props.opencodeRouterInfo?.healthPort ?? null,
        pid: props.opencodeRouterInfo?.pid ?? null,
        stdout: opencodeRouterStdout(),
        stderr: opencodeRouterStderr(),
      },
    },
    diagnostics: props.openworkServerDiagnostics,
    capabilities: props.openworkServerCapabilities,
    pendingPermissions: props.pendingPermissions,
    recentEvents: props.events,
    workspaceDebugEvents: props.workspaceDebugEvents,
    sandboxCreateProgress: {
      ...sandboxCreateSummary(),
      lastRunAt: sandboxCreateSummary().startedAt ? new Date(sandboxCreateSummary().startedAt!).toISOString() : null,
    },
    sandboxProbe: sandboxProbeResult(),
  }));

  const runtimeDebugReportJson = createMemo(() => `${JSON.stringify(runtimeDebugReport(), null, 2)}\n`);

  const copyRuntimeDebugReport = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setDebugReportStatus(translate("settings.clipboard_unavailable"));
      return;
    }
    try {
      await navigator.clipboard.writeText(runtimeDebugReportJson());
      setDebugReportStatus(translate("settings.copied_runtime_report"));
    } catch (error) {
      setDebugReportStatus(error instanceof Error ? error.message : translate("settings.failed_copy_report"));
    }
  };

  const exportRuntimeDebugReport = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      setDebugReportStatus(translate("settings.export_unavailable"));
      return;
    }
    try {
      const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
      const blob = new Blob([runtimeDebugReportJson()], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `openwork-debug-report-${stamp}.json`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setDebugReportStatus(translate("settings.exported_runtime_report"));
    } catch (error) {
      setDebugReportStatus(error instanceof Error ? error.message : translate("settings.failed_export_report"));
    }
  };

  const revealWorkspaceConfig = async () => {
    if (!isTauriRuntime() || revealConfigBusy()) return;
    const path = workspaceConfigPath();
    if (!path) {
      setConfigActionStatus(translate("settings.select_workspace_before_reveal"));
      return;
    }
    setRevealConfigBusy(true);
    setConfigActionStatus(null);
    try {
      const { openPath, revealItemInDir } = await import("@tauri-apps/plugin-opener");
      if (isWindowsPlatform()) {
        await openPath(path);
      } else {
        await revealItemInDir(path);
      }
      setConfigActionStatus(translate("settings.revealed_workspace_config"));
    } catch (error) {
      setConfigActionStatus(error instanceof Error ? error.message : translate("settings.failed_reveal_config"));
    } finally {
      setRevealConfigBusy(false);
    }
  };

  const resetAppConfigDefaults = async () => {
    if (resetConfigBusy()) return;
    setResetConfigBusy(true);
    setConfigActionStatus(null);
    try {
      const result = await props.resetAppConfigDefaults();
      setConfigActionStatus(result.message);
    } catch (error) {
      setConfigActionStatus(error instanceof Error ? error.message : translate("settings.failed_reset_config"));
    } finally {
      setResetConfigBusy(false);
    }
  };

  const handleNukeOpencodeDevConfig = async () => {
    if (!isTauriRuntime() || !opencodeDevModeEnabled() || nukeDevConfigBusy()) return;
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(translate("settings.nuke_dev_config_confirm"));
    if (!confirmed) return;
    setNukeDevConfigBusy(true);
    setNukeDevConfigStatus(null);
    try {
      await nukeOpencodeDevConfigAndExit();
      setNukeDevConfigStatus(translate("settings.nuke_dev_config_success"));
    } catch (error) {
      setNukeDevConfigStatus(error instanceof Error ? error.message : translate("settings.nuke_dev_config_failed"));
      setNukeDevConfigBusy(false);
    }
  };

  const runSandboxDebugProbe = async () => {
    if (!isTauriRuntime() || sandboxProbeBusy()) return;
    setSandboxProbeBusy(true);
    setSandboxProbeStatus(null);
    try {
      const report = await sandboxDebugProbe();
      setSandboxProbeResult(report);
      if (report.ready) {
        setSandboxProbeStatus(translate("settings.sandbox_probe_success"));
      } else {
        setSandboxProbeStatus(report.error?.trim() || translate("settings.sandbox_probe_errors"));
      }
    } catch (error) {
      setSandboxProbeStatus(error instanceof Error ? error.message : translate("settings.sandbox_probe_failed"));
    } finally {
      setSandboxProbeBusy(false);
    }
  };

  const submitDebugShareLink = async () => {
    if (debugShareLinkBusy()) return;
    setDebugShareLinkBusy(true);
    setDebugShareLinkStatus(null);
    try {
      const result = await props.openDebugShareLink(debugShareLinkInput());
      setDebugShareLinkStatus(result.message);
    } catch (error) {
      setDebugShareLinkStatus(error instanceof Error ? error.message : "Failed to open share link.");
    } finally {
      setDebugShareLinkBusy(false);
    }
  };

  const compactOutlineActionClass =
    "inline-flex items-center gap-1.5 rounded-md border border-dls-border bg-dls-surface px-3 py-1.5 text-xs font-medium text-dls-secondary shadow-sm transition-colors duration-150 hover:bg-dls-hover hover:text-dls-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--dls-accent-rgb),0.25)] disabled:cursor-not-allowed disabled:opacity-60";
  const compactDangerActionClass =
    "inline-flex items-center gap-1.5 rounded-md border border-red-7/35 bg-red-3/25 px-3 py-1.5 text-xs font-medium text-red-11 transition-colors duration-150 hover:border-red-7/50 hover:bg-red-3/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-7/35 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section class="space-y-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl border border-gray-6/40 bg-gray-1/40 px-3 py-2">
        <div class="flex flex-wrap gap-2">
          <For each={availableTabs()}>
            {(tab) => (
              <button
                class={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  activeTab() === tab
                    ? "bg-gray-12/10 text-white border-gray-6/30"
                    : "text-gray-10 border-gray-6/50 hover:text-gray-12 hover:bg-gray-2/40"
                }`}
                onClick={() => props.setSettingsTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            )}
          </For>
        </div>
        <Show when={showUpdateToolbar()}>
          <div class="flex flex-wrap items-center gap-2">
            <div
              class={`text-xs px-2 py-1 rounded-full border flex items-center gap-2 ${updateToolbarTone()}`}
              title={updateToolbarTitle()}
            >
              <Show when={updateToolbarSpinning()}>
                <RefreshCcw size={12} class="animate-spin" />
              </Show>
              <span class="tabular-nums whitespace-nowrap">{updateToolbarLabel()}</span>
            </div>
            <Show when={updateToolbarActionLabel()}>
              <Button
                variant="outline"
                class="text-xs h-8 py-0 px-3 rounded-full border-gray-6/60 bg-gray-1/70 hover:bg-gray-2/70"
                onClick={handleUpdateToolbarAction}
                disabled={updateToolbarDisabled()}
                title={updateState() === "ready" && props.anyActiveRuns ? translate("settings.stop_active_runs_hint") : ""}
              >
                {updateToolbarActionLabel()}
              </Button>
            </Show>
          </div>
        </Show>
      </div>

      <Switch>
        <Match when={activeTab() === "general"}>
          <div class="space-y-6">
            <div class="bg-gray-2/30 border border-gray-7/60 rounded-2xl p-5 space-y-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2">
                    <PlugZap size={16} class="text-gray-11" />
                    <div class="text-sm font-medium text-gray-12">{translate("settings.providers_title")}</div>
                  </div>
                  <div class="text-xs text-gray-9 mt-1">{translate("settings.providers_hint")}</div>
                </div>
                <div class={`text-xs px-2 py-1 rounded-full border ${providerStatusStyle()}`}>
                  {providerStatusLabel()}
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handleOpenProviderAuth}
                  disabled={props.busy || props.providerAuthBusy}
                >
                  {props.providerAuthBusy ? translate("settings.loading_providers") : translate("settings.connect_provider")}
                </Button>
                <div class="text-xs text-gray-10">{providerSummary()}</div>
              </div>

              <Show when={connectedProviders().length > 0}>
                <div class="space-y-2">
                  <For each={connectedProviders()}>
                    {(provider) => (
                      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-6/60 bg-gray-1/40 px-3 py-2">
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-gray-12 truncate">{provider.name}</div>
                          <div class="text-[11px] text-gray-8 font-mono truncate">{provider.id}</div>
                        </div>
                        <Button
                          variant="outline"
                          class="text-xs h-8 py-0 px-3"
                          onClick={() => void handleDisconnectProvider(provider.id)}
                          disabled={
                            props.busy || props.providerAuthBusy || providerDisconnectingId() !== null
                          }
                        >
                          {providerDisconnectingId() === provider.id ? translate("settings.disconnecting") : translate("settings.disconnect")}
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={providerConnectError()}>
                <div class="rounded-xl border border-red-7/30 bg-red-1/40 px-3 py-2 text-xs text-red-11">
                  {providerConnectError()}
                </div>
              </Show>
              <Show when={providerDisconnectStatus()}>
                <div class="rounded-xl border border-gray-6/60 bg-gray-1/40 px-3 py-2 text-xs text-gray-10">
                  {providerDisconnectStatus()}
                </div>
              </Show>
              <Show when={providerDisconnectError()}>
                <div class="rounded-xl border border-red-7/30 bg-red-1/40 px-3 py-2 text-xs text-red-11">
                  {providerDisconnectError()}
                </div>
              </Show>

              <div class="text-[11px] text-gray-9">
                {translate("settings.api_keys_stored_locally")}
              </div>
            </div>

            <div class="bg-gray-2/30 border border-gray-7/60 rounded-2xl p-5 space-y-4">
              <div>
                <div class="text-sm font-medium text-gray-12">{translate("settings.appearance_title")}</div>
                <div class="text-xs text-gray-9">{translate("settings.appearance_hint")}</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button
                  variant={props.themeMode === "system" ? "secondary" : "outline"}
                  class="text-xs h-8 py-0 px-3"
                  onClick={() => props.setThemeMode("system")}
                  disabled={props.busy}
                >
                  {translate("settings.theme_system")}
                </Button>
                <Button
                  variant={props.themeMode === "light" ? "secondary" : "outline"}
                  class="text-xs h-8 py-0 px-3"
                  onClick={() => props.setThemeMode("light")}
                  disabled={props.busy}
                >
                  {translate("settings.theme_light")}
                </Button>
                <Button
                  variant={props.themeMode === "dark" ? "secondary" : "outline"}
                  class="text-xs h-8 py-0 px-3"
                  onClick={() => props.setThemeMode("dark")}
                  disabled={props.busy}
                >
                  {translate("settings.theme_dark")}
                </Button>
              </div>

              <div class="space-y-2">
                <div class="text-xs font-medium text-gray-11">{translate("settings.language")}</div>
                <div class="text-xs text-gray-9">{translate("settings.language.description")}</div>
                <div class="flex flex-wrap gap-2">
                  <For each={LANGUAGE_OPTIONS}>
                    {(option) => (
                      <Button
                        variant={props.language === option.value ? "secondary" : "outline"}
                        class="text-xs h-8 py-0 px-3"
                        onClick={() => props.setLanguage(option.value)}
                        disabled={props.busy}
                      >
                        {option.nativeName}
                      </Button>
                    )}
                  </For>
                </div>
              </div>

              <div class="text-xs text-gray-8">
                {translate("settings.theme_system_hint")}
              </div>
            </div>

            {/* Feedback section removed for Abel branding */}
          </div>
        </Match>

        <Match when={activeTab() === "model"}>
          <div class="space-y-6">
            <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
              <div>
                <div class="text-sm font-medium text-gray-12">{translate("settings.model_title")}</div>
                <div class="text-xs text-gray-10">{translate("settings.model_hint")}</div>
              </div>

              <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-gray-12 truncate">{props.defaultModelLabel}</div>
                  <div class="text-xs text-gray-7 font-mono truncate">{props.defaultModelRef}</div>
                </div>
                <Button
                  variant="outline"
                  class="text-xs h-8 py-0 px-3 shrink-0"
                  onClick={props.openDefaultModelPicker}
                  disabled={props.busy}
                >
                  {translate("settings.change")}
                </Button>
              </div>

              <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-gray-12">{translate("settings.thinking_label")}</div>
                  <div class="text-xs text-gray-7">{translate("settings.thinking_hint")}</div>
                </div>
                <Button
                  variant="outline"
                  class="text-xs h-8 py-0 px-3 shrink-0"
                  onClick={props.toggleShowThinking}
                  disabled={props.busy}
                >
                  {props.showThinking ? translate("settings.on") : translate("settings.off")}
                </Button>
              </div>

              <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-gray-12">{translate("settings.auto_compact_label")}</div>
                  <div class="text-xs text-gray-7">{translate("settings.auto_compact_hint")}</div>
                </div>
                <Button
                  variant="outline"
                  class="text-xs h-8 py-0 px-3 shrink-0"
                  onClick={props.toggleAutoCompactContext}
                  disabled={props.busy}
                >
                  {props.autoCompactContext ? translate("settings.on") : translate("settings.off")}
                </Button>
              </div>

              <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-gray-12">{translate("settings.model_variant_label")}</div>
                  <div class="text-xs text-gray-7 font-mono truncate">{props.modelVariantLabel}</div>
                </div>
                <Button
                  variant="outline"
                  class="text-xs h-8 py-0 px-3 shrink-0"
                  onClick={props.editModelVariant}
                  disabled={props.busy}
                >
                  {translate("settings.edit")}
                </Button>
              </div>
            </div>
          </div>
        </Match>

        <Match when={activeTab() === "advanced"}>
          <div class="space-y-6">
            <div class="bg-gray-2/30 border border-gray-7/60 rounded-2xl p-5 space-y-4">
              <div>
                <div class="text-sm font-medium text-gray-12">{translate("settings.runtime_title")}</div>
                <div class="text-xs text-gray-9">{translate("settings.runtime_hint")}</div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-gray-6/60 bg-gray-1/40 p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-6/60 bg-gray-1/70 text-gray-12">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-12">{translate("settings.opencode_engine_title")}</div>
                      <div class="text-xs text-gray-9">{translate("settings.opencode_engine_hint")}</div>
                    </div>
                  </div>
                  <div class={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${clientStatusStyle()}`}>
                    <span class={`h-2 w-2 rounded-full ${clientStatusDot()}`} />
                    {clientStatusLabel()}
                  </div>
                </div>

                <div class="rounded-xl border border-gray-6/60 bg-gray-1/40 p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-6/60 bg-gray-1/70 text-gray-12">
                      <Server size={18} />
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-12">{translate("settings.openwork_server_title")}</div>
                      <div class="text-xs text-gray-9">{translate("settings.openwork_server_hint")}</div>
                    </div>
                  </div>
                  <div class={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${openworkStatusStyle()}`}>
                    <span class={`h-2 w-2 rounded-full ${openworkStatusDot()}`} />
                    {openworkStatusLabel()}
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-gray-2/30 border border-gray-7/60 rounded-2xl p-5 space-y-3">
              <div class="text-sm font-medium text-gray-12">{translate("settings.developer_mode_title")}</div>
              <div class="text-xs text-gray-9">
                {translate("settings.developer_mode_hint")}
              </div>
              <div class="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class={`${compactOutlineActionClass} ${
                    props.developerMode
                      ? "border-blue-7/35 bg-blue-3/20 text-blue-11 hover:bg-blue-3/35 hover:text-blue-11"
                      : ""
                  }`}
                  onClick={props.toggleDeveloperMode}
                >
                  <Zap size={14} class={props.developerMode ? "text-blue-10" : "text-dls-secondary"} />
                  {props.developerMode ? translate("settings.disable_developer_mode") : translate("settings.enable_developer_mode")}
                </button>
                <div class="text-xs text-gray-10">
                  {props.developerMode ? translate("settings.developer_panel_enabled") : translate("settings.developer_panel_enable_hint")}
                </div>
              </div>
              <Show when={isTauriRuntime() && opencodeDevModeEnabled()}>
                <div class="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class={compactDangerActionClass}
                    onClick={() => void handleNukeOpencodeDevConfig()}
                    disabled={props.busy || nukeDevConfigBusy()}
                  >
                    <CircleAlert size={14} />
                    {nukeDevConfigBusy() ? translate("settings.nuking_dev_config") : translate("settings.nuke_dev_config")}
                  </button>
                  <div class="text-xs text-gray-10">
                    {translate("settings.nuke_dev_config_description")}
                  </div>
                </div>
                <Show when={nukeDevConfigStatus()}>
                  {(value) => <div class="text-xs text-red-11">{value()}</div>}
                </Show>

                <Show when={props.developerMode}>
                  <div class="rounded-xl border border-gray-6/60 bg-gray-1/40 p-4 space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-sm font-medium text-gray-12">{translate("settings.open_share_link_title")}</div>
                        <div class="text-xs text-gray-9">
                          {translate("settings.open_share_link_hint")}
                        </div>
                      </div>
                      <button
                        type="button"
                        class={compactOutlineActionClass}
                        onClick={() => {
                          setDebugShareLinkOpen((value) => !value);
                          setDebugShareLinkStatus(null);
                        }}
                        disabled={props.busy || debugShareLinkBusy()}
                      >
                        {debugShareLinkOpen() ? translate("settings.hide") : translate("settings.open_share_link_action")}
                      </button>
                    </div>

                    <Show when={debugShareLinkOpen()}>
                      <div class="space-y-3">
                        <textarea
                          value={debugShareLinkInput()}
                          onInput={(event) => setDebugShareLinkInput(event.currentTarget.value)}
                          rows={3}
                          placeholder="openwork://import-bundle?ow_bundle=..."
                          class="w-full rounded-xl border border-gray-6 bg-gray-1 px-3 py-2 text-xs font-mono text-gray-12 outline-none transition focus:border-blue-8"
                        />
                        <div class="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            class="text-xs h-8 py-0 px-3"
                            onClick={() => void submitDebugShareLink()}
                            disabled={props.busy || debugShareLinkBusy() || !debugShareLinkInput().trim()}
                          >
                            {debugShareLinkBusy() ? translate("settings.opening") : translate("settings.open_link")}
                          </Button>
                          <div class="text-[11px] text-gray-8">
                            Accepts <span class="font-mono">openwork://</span>, <span class="font-mono">openwork-dev://</span>, or a raw <span class="font-mono">https://share.openwork.software/b/...</span> URL.
                          </div>
                        </div>
                      </div>
                    </Show>

                    <Show when={debugShareLinkStatus()}>
                      {(value) => <div class="text-xs text-gray-10">{value()}</div>}
                    </Show>
                  </div>
                </Show>
              </Show>
            </div>

            <div class="bg-gray-2/30 border border-gray-7/60 rounded-2xl p-5 space-y-3">
              <div class="text-sm font-medium text-gray-12">{translate("settings.connection_title")}</div>
              <div class="text-xs text-gray-9">{props.headerStatus}</div>
              <div class="text-xs text-gray-8 font-mono break-all">{props.baseUrl}</div>
              <div class="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  class={compactOutlineActionClass}
                  onClick={handleReconnectOpenworkServer}
                  disabled={props.busy || props.openworkReconnectBusy || !props.openworkServerUrl.trim()}
                >
                  <RefreshCcw size={14} class={`text-dls-secondary ${props.openworkReconnectBusy ? "animate-spin" : ""}`} />
                  {props.openworkReconnectBusy ? translate("settings.reconnecting") : translate("settings.reconnect_server")}
                </button>
                <Show when={isLocalEngineRunning()}>
                  <button
                    type="button"
                    class={compactOutlineActionClass}
                    onClick={handleRestartLocalServer}
                    disabled={props.busy || openworkRestartBusy()}
                  >
                    <RefreshCcw size={14} class={`text-dls-secondary ${openworkRestartBusy() ? "animate-spin" : ""}`} />
                    {openworkRestartBusy() ? translate("settings.restarting") : translate("settings.restart_local_server")}
                  </button>
                </Show>
                <Show when={isLocalEngineRunning()}>
                  <button
                    type="button"
                    class={compactDangerActionClass}
                    onClick={props.stopHost}
                    disabled={props.busy}
                  >
                    <CircleAlert size={14} />
                    {translate("settings.stop_local_server")}
                  </button>
                </Show>
                <Show when={!isLocalEngineRunning() && props.openworkServerStatus === "connected"}>
                  <button
                    type="button"
                    class={compactOutlineActionClass}
                    onClick={props.stopHost}
                    disabled={props.busy}
                  >
                    {translate("settings.disconnect_server")}
                  </button>
                </Show>
              </div>
              <Show when={openworkReconnectStatus()}>
                {(value) => <div class="text-xs text-gray-10">{value()}</div>}
              </Show>
              <Show when={openworkReconnectError()}>
                {(value) => <div class="text-xs text-red-11">{value()}</div>}
              </Show>
              <Show when={openworkRestartStatus()}>
                {(value) => <div class="text-xs text-gray-10">{value()}</div>}
              </Show>
              <Show when={openworkRestartError()}>
                {(value) => <div class="text-xs text-red-11">{value()}</div>}
              </Show>
            </div>

            <div class="bg-gray-2/30 border border-gray-7/60 rounded-2xl p-5 space-y-4">
              <div>
                <div class="text-sm font-medium text-gray-12">{translate("settings.migration_recovery_label")}</div>
                <div class="text-xs text-gray-9">{translate("settings.migration_recovery_hint")}</div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  class="text-xs h-8 py-0 px-3"
                  onClick={props.repairOpencodeMigration}
                  disabled={props.busy || props.migrationRepairBusy || !props.migrationRepairAvailable}
                  title={props.migrationRepairUnavailableReason ?? ""}
                >
                  {props.migrationRepairBusy
                    ? translate("settings.fixing_migration")
                    : translate("settings.fix_migration")}
                </Button>
              </div>
              <Show when={props.migrationRepairUnavailableReason}>
                {(reason) => <div class="text-xs text-amber-11">{reason()}</div>}
              </Show>
              <Show when={props.migrationRepairBusy}>
                <div class="text-xs text-gray-10">{translate("status.repairing_migration")}</div>
              </Show>
              <Show when={props.migrationRepairResult}>
                {(result) => (
                  <div
                    class={`rounded-xl border px-3 py-2 text-xs ${
                      result().ok
                        ? "border-green-7/30 bg-green-2/30 text-green-12"
                        : "border-red-7/30 bg-red-2/30 text-red-12"
                    }`}
                  >
                    {result().message}
                  </div>
                )}
              </Show>
            </div>

            <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-sm font-medium text-gray-12">{translate("settings.updates_title")}</div>
                  <div class="text-xs text-gray-10">{translate("settings.updates_hint")}</div>
                </div>
                <div class="text-xs text-gray-7 font-mono">{props.appVersion ? `v${props.appVersion}` : ""}</div>
              </div>

              <Show
                when={!isTauriRuntime()}
                fallback={
                  <Show
                    when={props.updateEnv && props.updateEnv.supported === false}
                    fallback={
                      <>
                        <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6">
                          <div class="space-y-0.5">
                            <div class="text-sm text-gray-12">{translate("settings.background_checks")}</div>
                            <div class="text-xs text-gray-7">{translate("settings.background_checks_hint")}</div>
                          </div>
                          <button
                            class={`min-w-[70px] px-4 py-1.5 rounded-full text-xs font-medium border shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-colors ${
                              props.updateAutoCheck
                                ? "bg-gray-12/12 text-gray-12 border-gray-6/30"
                                : "bg-gray-1/70 text-gray-10 border-gray-6/60 hover:text-gray-12 hover:bg-gray-2/70"
                            }`}
                            onClick={props.toggleUpdateAutoCheck}
                          >
                            {props.updateAutoCheck ? translate("settings.on") : translate("settings.off")}
                          </button>
                        </div>

                        <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6">
                          <div class="space-y-0.5">
                            <div class="text-sm text-gray-12">{translate("settings.auto_update")}</div>
                            <div class="text-xs text-gray-7">{translate("settings.auto_update_hint")}</div>
                          </div>
                          <button
                            class={`min-w-[70px] px-4 py-1.5 rounded-full text-xs font-medium border shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-colors ${
                              props.updateAutoDownload
                                ? "bg-gray-12/12 text-gray-12 border-gray-6/30"
                                : "bg-gray-1/70 text-gray-10 border-gray-6/60 hover:text-gray-12 hover:bg-gray-2/70"
                            }`}
                            onClick={props.toggleUpdateAutoDownload}
                          >
                            {props.updateAutoDownload ? translate("settings.on") : translate("settings.off")}
                          </button>
                        </div>

                        <div class="flex items-center justify-between gap-3 bg-gray-1 p-3 rounded-xl border border-gray-6">
                          <div class="space-y-0.5">
                            <div class="text-sm text-gray-12">
                              <Switch>
                                <Match when={updateState() === "checking"}>{translate("settings.update_checking")}</Match>
                                <Match when={updateState() === "available"}>{translate("settings.update_available")}v{updateVersion()}</Match>
                                <Match when={updateState() === "downloading"}>{translate("settings.update_downloading")}</Match>
                                <Match when={updateState() === "ready"}>{translate("settings.update_ready")}v{updateVersion()}</Match>
                                <Match when={updateState() === "error"}>{translate("settings.update_error")}</Match>
                                <Match when={true}>{translate("settings.update_uptodate")}</Match>
                              </Switch>
                            </div>
                            <Show when={updateState() === "idle" && updateLastCheckedAt()}>
                              <div class="text-xs text-gray-7">
                                {translate("settings.last_checked_time").replace("{time}", formatRelativeTime(updateLastCheckedAt() as number))}
                              </div>
                            </Show>
                            <Show when={updateState() === "available" && updateDate()}>
                              <div class="text-xs text-gray-7">{translate("settings.published_date").replace("{date}", updateDate() as string)}</div>
                            </Show>
                            <Show when={updateState() === "downloading"}>
                              <div class="text-xs text-gray-7">
                                {formatBytes((updateDownloadedBytes() as number) ?? 0)}
                                <Show when={updateTotalBytes() != null}>
                                  {` / ${formatBytes(updateTotalBytes() as number)}`}
                                </Show>
                              </div>
                            </Show>
                            <Show when={updateState() === "error"}>
                              <div class="text-xs text-red-11">{updateErrorMessage()}</div>
                            </Show>
                          </div>

                          <div class="flex items-center gap-2">
                            <Button
                              variant="outline"
                              class="text-xs h-9 py-0 px-4 rounded-full border-gray-6/60 bg-gray-1/70 hover:bg-gray-2/70"
                              onClick={props.checkForUpdates}
                              disabled={props.busy || updateState() === "checking" || updateState() === "downloading"}
                            >
                              {translate("settings.check_update")}
                            </Button>

                            <Show when={updateState() === "available"}>
                              <Button
                                variant="secondary"
                                class="text-xs h-9 py-0 px-4 rounded-full"
                                onClick={props.downloadUpdate}
                                disabled={props.busy || updateState() === "downloading"}
                              >
                                {translate("settings.download_update")}
                              </Button>
                            </Show>

                            <Show when={updateState() === "ready"}>
                              <Button
                                variant="secondary"
                                class="text-xs h-9 py-0 px-4 rounded-full"
                                onClick={props.installUpdateAndRestart}
                                disabled={props.busy || props.anyActiveRuns}
                                title={props.anyActiveRuns ? translate("settings.stop_active_runs_hint") : ""}
                              >
                                {translate("settings.install_restart")}
                              </Button>
                            </Show>
                          </div>
                        </div>

                        <Show when={updateState() === "available" && updateNotes()}>
                          <div class="rounded-xl bg-gray-1/20 border border-gray-6 p-3 text-xs text-gray-11 whitespace-pre-wrap max-h-40 overflow-auto">
                            {updateNotes()}
                          </div>
                        </Show>
                      </>
                    }
                  >
                    <div class="rounded-xl bg-gray-1/20 border border-gray-6 p-3 text-sm text-gray-11">
                      {props.updateEnv?.reason ?? translate("settings.update_not_supported_hint")}
                    </div>
                  </Show>
                }
              >
                <div class="rounded-xl bg-gray-1/20 border border-gray-6 p-3 text-sm text-gray-11">
                  {translate("settings.update_desktop_only_hint")}
                </div>
              </Show>
            </div>

            <Show when={isTauriRuntime()}>
              <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-3">
                <div>
                  <div class="text-sm font-medium text-gray-12">{translate("settings.appearance_title")}</div>
                  <div class="text-xs text-gray-10">{translate("settings.window_appearance_hint")}</div>
                </div>

                <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                  <div class="min-w-0">
                    <div class="text-sm text-gray-12">{translate("settings.hide_titlebar")}</div>
                    <div class="text-xs text-gray-7">
                      {translate("settings.hide_titlebar_hint")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    class="text-xs h-8 py-0 px-3 shrink-0"
                    onClick={props.toggleHideTitlebar}
                    disabled={props.busy}
                  >
                    {props.hideTitlebar ? translate("settings.on") : translate("settings.off")}
                  </Button>
                </div>
              </div>
            </Show>

          </div>
        </Match>

        <Match when={activeTab() === "debug"}>
          <Show when={props.developerMode}>
            <section>
              <h3 class="text-sm font-medium text-gray-11 uppercase tracking-wider mb-4">{translate("settings.developer_title")}</h3>

              <div class="space-y-4">
                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-sm font-medium text-gray-12">{translate("settings.debug_report_title")}</div>
                      <div class="text-xs text-gray-10">{translate("settings.debug_report_hint")}</div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <Button variant="outline" class="text-xs h-8 py-0 px-3" onClick={copyRuntimeDebugReport}>
                        <Copy size={13} class="mr-1.5" />
                        {translate("settings.copy_json")}
                      </Button>
                      <Button variant="secondary" class="text-xs h-8 py-0 px-3" onClick={exportRuntimeDebugReport}>
                        <Download size={13} class="mr-1.5" />
                        {translate("settings.export")}
                      </Button>
                    </div>
                  </div>
                  <div class="grid gap-2 md:grid-cols-2 text-xs text-gray-11">
                    <div>{translate("settings.label_desktop_app")}: {appVersionLabel()}</div>
                    <div>{translate("settings.label_commit")}: {appCommitLabel()}</div>
                    <div>{translate("settings.label_orchestrator")}: {orchestratorVersionLabel()}</div>
                    <div>OpenCode: {opencodeVersionLabel()}</div>
                    <div>{translate("settings.label_openwork_server")}: {openworkServerVersionLabel()}</div>
                    <div>OpenCodeRouter: {opencodeRouterVersionLabel()}</div>
                  </div>
                  <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-64 overflow-auto bg-gray-1 border border-gray-6 rounded-lg p-3">
                    {runtimeDebugReportJson()}
                  </pre>
                  <Show when={debugReportStatus()}>
                    {(status) => <div class="text-xs text-gray-10">{status()}</div>}
                  </Show>
                </div>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-sm font-medium text-gray-12">{translate("settings.sandbox_probe_title")}</div>
                      <div class="text-xs text-gray-10">
                        {translate("settings.sandbox_probe_hint")}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      class="text-xs h-8 py-0 px-3"
                      onClick={runSandboxDebugProbe}
                      disabled={!isTauriRuntime() || sandboxProbeBusy() || props.anyActiveRuns}
                      title={
                        !isTauriRuntime()
                          ? translate("settings.sandbox_requires_desktop")
                          : props.anyActiveRuns
                            ? translate("settings.stop_runs_before_probe")
                            : ""
                      }
                    >
                      {sandboxProbeBusy() ? translate("settings.running_probe") : translate("settings.run_sandbox_probe")}
                    </Button>
                  </div>
                  <Show when={sandboxProbeResult()}>
                    {(result) => (
                      <div class="text-xs text-gray-11 space-y-1">
                        <div>Run ID: <span class="font-mono">{result().runId}</span></div>
                        <div>Result: {result().ready ? "ready" : "error"}</div>
                        <Show when={result().error}>
                          {(err) => <div class="text-red-11">{err()}</div>}
                        </Show>
                      </div>
                    )}
                  </Show>
                  <Show when={sandboxProbeStatus()}>
                    {(status) => <div class="text-xs text-gray-10">{status()}</div>}
                  </Show>
                  <div class="text-[11px] text-gray-7">
                    {translate("settings.sandbox_probe_export_hint")}
                  </div>
                </div>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-3">
                  <div class="text-sm font-medium text-gray-12">{translate("settings.workspace_config_title")}</div>
                  <div class="text-xs text-gray-10">{translate("settings.workspace_config_hint")}</div>
                  <div class="text-[11px] text-gray-7 font-mono break-all">{workspaceConfigPath() || translate("settings.no_active_workspace")}</div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      class="text-xs h-8 py-0 px-3"
                      onClick={revealWorkspaceConfig}
                      disabled={!isTauriRuntime() || revealConfigBusy() || !workspaceConfigPath()}
                      title={!isTauriRuntime() ? translate("settings.reveal_requires_desktop") : ""}
                    >
                      <FolderOpen size={13} class="mr-1.5" />
                      {revealConfigBusy() ? translate("settings.opening") : translate("settings.reveal_config")}
                    </Button>
                    <Button
                      variant="danger"
                      class="text-xs h-8 py-0 px-3"
                      onClick={resetAppConfigDefaults}
                      disabled={resetConfigBusy() || props.anyActiveRuns}
                      title={props.anyActiveRuns ? translate("settings.stop_runs_before_reset") : ""}
                    >
                      {resetConfigBusy() ? translate("settings.resetting") : translate("settings.reset_config_defaults")}
                    </Button>
                  </div>
                  <Show when={configActionStatus()}>
                    {(status) => <div class="text-xs text-gray-10">{status()}</div>}
                  </Show>
                </div>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div class="min-w-0">
                    <div class="text-sm text-gray-12">{translate("settings.opencode_cache_label")}</div>
                    <div class="text-xs text-gray-7">
                      {translate("settings.opencode_cache_hint")}
                    </div>
                    <Show when={props.cacheRepairResult}>
                      <div class="text-xs text-gray-11 mt-2">{props.cacheRepairResult}</div>
                    </Show>
                  </div>
                  <Button
                    variant="secondary"
                    class="text-xs h-8 py-0 px-3 shrink-0"
                    onClick={props.repairOpencodeCache}
                    disabled={props.cacheRepairBusy || !isTauriRuntime()}
                    title={isTauriRuntime() ? "" : translate("settings.cache_repair_requires_desktop")}
                  >
                    {props.cacheRepairBusy ? translate("settings.repairing_cache") : translate("settings.repair_cache")}
                  </Button>
                </div>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div class="min-w-0">
                    <div class="text-sm text-gray-12">{translate("settings.docker_containers_title")}</div>
                    <div class="text-xs text-gray-7">
                      {translate("settings.docker_containers_hint")}
                    </div>
                    <Show when={props.dockerCleanupResult}>
                      <div class="text-xs text-gray-11 mt-2">{props.dockerCleanupResult}</div>
                    </Show>
                  </div>
                  <Button
                    variant="danger"
                    class="text-xs h-8 py-0 px-3 shrink-0"
                    onClick={props.cleanupOpenworkDockerContainers}
                    disabled={props.dockerCleanupBusy || props.anyActiveRuns || !isTauriRuntime()}
                    title={
                      !isTauriRuntime()
                        ? translate("settings.docker_requires_desktop")
                        : props.anyActiveRuns
                          ? translate("settings.stop_runs_before_cleanup")
                          : ""
                    }
                  >
                    {props.dockerCleanupBusy ? translate("settings.removing_containers") : translate("settings.delete_containers")}
                  </Button>
                </div>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-3">
                  <div class="text-sm font-medium text-gray-12">{translate("settings.startup_title")}</div>

                  <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6">
                    <div class="flex items-center gap-3">
                      <div
                        class={`p-2 rounded-lg ${
                          isLocalPreference() ? "bg-indigo-7/10 text-indigo-11" : "bg-green-7/10 text-green-11"
                        }`}
                      >
                        <Show when={isLocalPreference()} fallback={<Smartphone size={18} />}>
                          <HardDrive size={18} />
                        </Show>
                      </div>
                      <span class="text-sm font-medium text-gray-12">{startupLabel()}</span>
                    </div>
                    <Button
                      variant="outline"
                      class="text-xs h-8 py-0 px-3"
                      onClick={props.stopHost}
                      disabled={props.busy}
                    >
                      {translate("settings.switch_mode")}
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    class="w-full justify-between group"
                    onClick={props.onResetStartupPreference}
                  >
                    <span>{translate("settings.reset_startup_label")}</span>
                    <RefreshCcw size={14} class="opacity-80 group-hover:rotate-180 transition-transform" />
                  </Button>

                  <p class="text-xs text-gray-7">
                    {translate("settings.reset_startup_hint")}
                  </p>
                </div>

                <Show when={isTauriRuntime() && (isLocalPreference() || props.developerMode)}>
                  <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
                    <div>
                      <div class="text-sm font-medium text-gray-12">{translate("settings.engine_title")}</div>
                      <div class="text-xs text-gray-10">{translate("settings.engine_hint")}</div>
                    </div>

                    <Show when={!isLocalPreference()}>
                      <div class="text-[11px] text-amber-11 bg-amber-3/40 border border-amber-7/40 rounded-lg px-3 py-2">
                        {translate("settings.engine_remote_notice")}
                      </div>
                    </Show>

                    <div class="space-y-3">
                      <div class="text-xs text-gray-10">{translate("settings.engine_source_label")}</div>
                      <div class={props.developerMode ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
                        <Button
                          variant={props.engineSource === "sidecar" ? "secondary" : "outline"}
                          onClick={() => props.setEngineSource("sidecar")}
                          disabled={props.busy}
                        >
                          {translate("settings.engine_bundled")}
                        </Button>
                        <Button
                          variant={props.engineSource === "path" ? "secondary" : "outline"}
                          onClick={() => props.setEngineSource("path")}
                          disabled={props.busy}
                        >
                          {translate("settings.engine_system_path")}
                        </Button>
                        <Show when={props.developerMode}>
                          <Button
                            variant={props.engineSource === "custom" ? "secondary" : "outline"}
                            onClick={() => props.setEngineSource("custom")}
                            disabled={props.busy}
                          >
                            {translate("settings.engine_custom_binary")}
                          </Button>
                        </Show>
                      </div>
                      <div class="text-[11px] text-gray-7">
                        {translate("settings.engine_source_hint")}
                      </div>
                    </div>

                    <Show when={props.developerMode && props.engineSource === "custom"}>
                      <div class="space-y-2">
                        <div class="text-xs text-gray-10">{translate("settings.custom_binary_label")}</div>
                        <div class="flex items-center gap-2">
                          <div
                            class="flex-1 min-w-0 text-[11px] text-gray-7 font-mono truncate bg-gray-1 p-3 rounded-xl border border-gray-6"
                            title={engineCustomBinPathLabel()}
                          >
                            {engineCustomBinPathLabel()}
                          </div>
                          <Button
                            variant="outline"
                            class="text-xs h-10 px-3 shrink-0"
                            onClick={handlePickEngineBinary}
                            disabled={props.busy}
                          >
                            {translate("settings.choose")}
                          </Button>
                          <Button
                            variant="outline"
                            class="text-xs h-10 px-3 shrink-0"
                            onClick={() => props.setEngineCustomBinPath("")}
                            disabled={props.busy || !props.engineCustomBinPath.trim()}
                            title={!props.engineCustomBinPath.trim() ? translate("settings.no_custom_path") : translate("settings.clear")}
                          >
                            {translate("settings.clear")}
                          </Button>
                        </div>
                        <div class="text-[11px] text-gray-7">
                          {translate("settings.custom_binary_hint")}
                        </div>
                      </div>
                    </Show>

                    <Show when={props.developerMode}>
                      <div class="space-y-3">
                        <div class="text-xs text-gray-10">{translate("settings.engine_runtime_label")}</div>
                        <div class="grid grid-cols-2 gap-2">
                          <Button
                            variant={props.engineRuntime === "direct" ? "secondary" : "outline"}
                            onClick={() => props.setEngineRuntime("direct")}
                            disabled={props.busy}
                          >
                            Direct (OpenCode)
                          </Button>
                          <Button
                            variant={props.engineRuntime === "openwork-orchestrator" ? "secondary" : "outline"}
                            onClick={() => props.setEngineRuntime("openwork-orchestrator")}
                            disabled={props.busy}
                          >
                            Abel Orchestrator
                          </Button>
                        </div>
                        <div class="text-[11px] text-gray-7">{translate("settings.engine_runtime_hint")}</div>
                      </div>
                    </Show>
                  </div>
                </Show>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
                  <div>
                    <div class="text-sm font-medium text-gray-12">{translate("settings.reset_recovery_title")}</div>
                    <div class="text-xs text-gray-10">{translate("settings.reset_recovery_hint")}</div>
                  </div>

                  <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                    <div class="min-w-0">
                      <div class="text-sm text-gray-12">{translate("settings.reset_onboarding_label")}</div>
                      <div class="text-xs text-gray-7">{translate("settings.reset_onboarding_hint")}</div>
                    </div>
                    <Button
                      variant="outline"
                      class="text-xs h-8 py-0 px-3 shrink-0"
                      onClick={() => props.openResetModal("onboarding")}
                      disabled={props.busy || props.resetModalBusy || props.anyActiveRuns}
                      title={props.anyActiveRuns ? translate("settings.stop_active_runs_reset_hint") : ""}
                    >
                      {translate("settings.reset")}
                    </Button>
                  </div>

                  <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                    <div class="min-w-0">
                      <div class="text-sm text-gray-12">{translate("settings.reset_app_data_label")}</div>
                      <div class="text-xs text-gray-7">{translate("settings.reset_app_data_hint")}</div>
                    </div>
                    <Button
                      variant="danger"
                      class="text-xs h-8 py-0 px-3 shrink-0"
                      onClick={() => props.openResetModal("all")}
                      disabled={props.busy || props.resetModalBusy || props.anyActiveRuns}
                      title={props.anyActiveRuns ? translate("settings.stop_active_runs_reset_hint") : ""}
                    >
                      {translate("settings.reset")}
                    </Button>
                  </div>

                  <div class="text-xs text-gray-7">
                    {translate("settings.reset_requires_hint")}
                  </div>
                </div>

                <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
                  <div>
                    <div class="text-sm font-medium text-gray-12">{translate("settings.devtools_title")}</div>
                    <div class="text-xs text-gray-10">{translate("settings.devtools_hint")}</div>
                  </div>

                  <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                    <div>
                      <div class="text-sm font-medium text-gray-12">{translate("settings.service_restarts_title")}</div>
                      <div class="text-xs text-gray-10">{translate("settings.service_restarts_hint")}</div>
                    </div>
                    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <Button
                        variant="secondary"
                        onClick={handleRestartLocalServer}
                        disabled={props.busy || openworkRestartBusy() || !isTauriRuntime()}
                        class="text-xs px-3 py-1.5 justify-center"
                      >
                        <RefreshCcw class={`w-3.5 h-3.5 mr-1.5 ${openworkRestartBusy() ? "animate-spin" : ""}`} />
                        {openworkRestartBusy() ? translate("settings.restarting") : translate("settings.restart_orchestrator")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleOpenCodeRestart}
                        disabled={opencodeRestarting() || !isTauriRuntime()}
                        class="text-xs px-3 py-1.5 justify-center"
                      >
                        <RefreshCcw class={`w-3.5 h-3.5 mr-1.5 ${opencodeRestarting() ? "animate-spin" : ""}`} />
                        {opencodeRestarting() ? translate("settings.restarting") : translate("settings.restart_opencode")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleOpenworkServerRestart}
                        disabled={openworkServerRestarting() || !isTauriRuntime()}
                        class="text-xs px-3 py-1.5 justify-center"
                      >
                        <RefreshCcw class={`w-3.5 h-3.5 mr-1.5 ${openworkServerRestarting() ? "animate-spin" : ""}`} />
                        {openworkServerRestarting() ? translate("settings.restarting") : translate("settings.restart_openwork_server")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleOpenCodeRouterRestart}
                        disabled={opencodeRouterRestarting() || !isTauriRuntime()}
                        class="text-xs px-3 py-1.5 justify-center"
                      >
                        <RefreshCcw class={`w-3.5 h-3.5 mr-1.5 ${opencodeRouterRestarting() ? "animate-spin" : ""}`} />
                        {opencodeRouterRestarting() ? translate("settings.restarting") : translate("settings.restart_opencode_router")}
                      </Button>
                    </div>
                    <Show when={openworkRestartStatus()}>
                      <div class="text-xs text-green-11 bg-green-3/50 border border-green-6 rounded-lg p-2">{openworkRestartStatus()}</div>
                    </Show>
                    <Show when={openworkRestartError() || opencodeRestartError() || openworkServerRestartError() || opencodeRouterRestartError()}>
                      <div class="text-xs text-red-11 bg-red-3/50 border border-red-6 rounded-lg p-2">
                        {openworkRestartError() || opencodeRestartError() || openworkServerRestartError() || opencodeRouterRestartError()}
                      </div>
                    </Show>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                      <div>
                        <div class="text-sm font-medium text-gray-12">{translate("settings.versions_title")}</div>
                        <div class="text-xs text-gray-10">{translate("settings.versions_hint")}</div>
                      </div>
                        <div class="space-y-1">
                          <div class="text-[11px] text-gray-7 font-mono truncate">{translate("settings.label_desktop_app")}: {appVersionLabel()}</div>
                          <div class="text-[11px] text-gray-7 font-mono truncate">{translate("settings.label_commit")}: {appCommitLabel()}</div>
                          <div class="text-[11px] text-gray-7 font-mono truncate">{translate("settings.label_orchestrator")}: {orchestratorVersionLabel()}</div>
                          <div class="text-[11px] text-gray-7 font-mono truncate">OpenCode: {opencodeVersionLabel()}</div>
                          <div class="text-[11px] text-gray-7 font-mono truncate">
                            {translate("settings.label_openwork_server")}: {openworkServerVersionLabel()}
                          </div>
                          <div class="text-[11px] text-gray-7 font-mono truncate">OpenCodeRouter: {opencodeRouterVersionLabel()}</div>
                        </div>
                    </div>

                    <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <div class="text-sm font-medium text-gray-12">{translate("settings.opencode_engine_title")}</div>
                          <div class="text-xs text-gray-10">{translate("settings.local_execution_sidecar")}</div>
                        </div>
                        <div class={`text-xs px-2 py-1 rounded-full border ${engineStatusStyle()}`}>
                          {engineStatusLabel()}
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.engineInfo?.baseUrl ?? "Base URL unavailable"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.engineInfo?.projectDir ?? "No project directory"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">PID: {props.engineInfo?.pid ?? "—"}</div>
                      </div>
                      <div class="grid gap-2">
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last stdout</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {engineStdout()}
                          </pre>
                        </div>
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last stderr</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {engineStderr()}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <div class="text-sm font-medium text-gray-12">{translate("settings.orchestrator_daemon_title")}</div>
                          <div class="text-xs text-gray-10">{translate("settings.orchestrator_daemon_hint")}</div>
                        </div>
                        <div class={`text-xs px-2 py-1 rounded-full border ${orchestratorStatusStyle()}`}>
                          {orchestratorStatusLabel()}
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.orchestratorStatus?.dataDir ?? "Data directory unavailable"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          Daemon: {props.orchestratorStatus?.daemon?.baseUrl ?? "—"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          OpenCode: {props.orchestratorStatus?.opencode?.baseUrl ?? "—"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          Version: {props.orchestratorStatus?.cliVersion ?? "—"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          Sidecar: {orchestratorSidecarSummary()}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate" title={orchestratorBinaryPath()}>
                          Opencode binary: {formatOrchestratorBinary(props.orchestratorStatus?.binaries?.opencode ?? null)}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          Active workspace: {props.orchestratorStatus?.activeId ?? "—"}
                        </div>
                      </div>
                      <Show when={props.orchestratorStatus?.lastError}>
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last error</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {props.orchestratorStatus?.lastError}
                          </pre>
                        </div>
                      </Show>
                    </div>

                    <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <div class="text-sm font-medium text-gray-12">OpenCode SDK</div>
                          <div class="text-xs text-gray-10">{translate("settings.sdk_diagnostics_hint")}</div>
                        </div>
                        <div class={`text-xs px-2 py-1 rounded-full border ${opencodeConnectStatusStyle()}`}>
                          {opencodeConnectStatusLabel()}
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.opencodeConnectStatus?.baseUrl ?? "Base URL unavailable"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.opencodeConnectStatus?.directory ?? "No project directory"}
                        </div>
                        <div class="text-[11px] text-gray-7">
                          Last attempt: {opencodeConnectTimestamp() ?? "—"}
                        </div>
                        <Show when={props.opencodeConnectStatus?.reason}>
                          <div class="text-[11px] text-gray-7">Reason: {props.opencodeConnectStatus?.reason}</div>
                        </Show>
                        <Show when={props.opencodeConnectStatus?.metrics}>
                          {(metrics) => (
                            <div class="pt-1 space-y-1 text-[11px] text-gray-7">
                              <Show when={metrics().healthyMs != null}>
                                <div>Healthy: {Math.round(metrics().healthyMs as number)}ms</div>
                              </Show>
                              <Show when={metrics().loadSessionsMs != null}>
                                <div>Load sessions: {Math.round(metrics().loadSessionsMs as number)}ms</div>
                              </Show>
                              <Show when={metrics().pendingPermissionsMs != null}>
                                <div>
                                  Pending permissions: {Math.round(metrics().pendingPermissionsMs as number)}ms
                                </div>
                              </Show>
                              <Show when={metrics().providersMs != null}>
                                <div>Providers: {Math.round(metrics().providersMs as number)}ms</div>
                              </Show>
                              <Show when={metrics().totalMs != null}>
                                <div>Total: {Math.round(metrics().totalMs as number)}ms</div>
                              </Show>
                            </div>
                          )}
                        </Show>
                      </div>
                      <Show when={props.opencodeConnectStatus?.error}>
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last error</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {props.opencodeConnectStatus?.error}
                          </pre>
                        </div>
                      </Show>
                    </div>

                    <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <div class="text-sm font-medium text-gray-12">{translate("settings.openwork_server_title")}</div>
                          <div class="text-xs text-gray-10">{translate("settings.config_approvals_sidecar")}</div>
                        </div>
                        <div class={`text-xs px-2 py-1 rounded-full border ${openworkStatusStyle()}`}>
                          {openworkStatusLabel()}
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {(props.openworkServerHostInfo?.baseUrl ?? props.openworkServerUrl) || "Base URL unavailable"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">PID: {props.openworkServerHostInfo?.pid ?? "—"}</div>
                      </div>
                      <div class="grid gap-2">
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last stdout</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {openworkStdout()}
                          </pre>
                        </div>
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last stderr</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {openworkStderr()}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <div class="text-sm font-medium text-gray-12">{translate("settings.opencode_router_title")}</div>
                          <div class="text-xs text-gray-10">{translate("settings.messaging_bridge_hint")}</div>
                        </div>
                        <div class={`text-xs px-2 py-1 rounded-full border ${opencodeRouterStatusStyle()}`}>
                          {opencodeRouterStatusLabel()}
                        </div>
                      </div>
                      <div class="space-y-1">
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.opencodeRouterInfo?.opencodeUrl?.trim() || "OpenCode URL unavailable"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          {props.opencodeRouterInfo?.workspacePath?.trim() || "No worker directory"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">
                          Health port: {props.opencodeRouterInfo?.healthPort ?? "—"}
                        </div>
                        <div class="text-[11px] text-gray-7 font-mono truncate">PID: {props.opencodeRouterInfo?.pid ?? "—"}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={handleOpenCodeRouterRestart}
                          disabled={opencodeRouterRestarting() || !isTauriRuntime()}
                          class="text-xs px-3 py-1.5"
                        >
                          <RefreshCcw class={`w-3.5 h-3.5 mr-1.5 ${opencodeRouterRestarting() ? "animate-spin" : ""}`} />
                          {opencodeRouterRestarting() ? translate("settings.restarting") : translate("settings.restart")}
                        </Button>
                        <Show when={props.opencodeRouterInfo?.running}>
                          <Button
                            variant="ghost"
                            onClick={handleOpenCodeRouterStop}
                            disabled={opencodeRouterRestarting()}
                            class="text-xs px-3 py-1.5"
                          >
                            {translate("settings.stop")}
                          </Button>
                        </Show>
                      </div>
                      <Show when={opencodeRouterRestartError()}>
                        <div class="text-xs text-red-11 bg-red-3/50 border border-red-6 rounded-lg p-2">
                          {opencodeRouterRestartError()}
                        </div>
                      </Show>
                      <div class="grid gap-2">
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last stdout</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {opencodeRouterStdout()}
                          </pre>
                        </div>
                        <div>
                          <div class="text-[11px] text-gray-9 mb-1">Last stderr</div>
                          <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-24 overflow-auto bg-gray-2/50 border border-gray-6 rounded-lg p-2">
                            {opencodeRouterStderr()}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-sm font-medium text-gray-12">{translate("settings.server_diagnostics_title")}</div>
                      <div class="text-[11px] text-gray-8 font-mono truncate">
                        {props.openworkServerDiagnostics?.version ?? "—"}
                      </div>
                    </div>
                    <Show
                      when={props.openworkServerDiagnostics}
                      fallback={<div class="text-xs text-gray-9">{translate("settings.diagnostics_unavailable")}</div>}
                    >
                      {(diag) => (
                        <div class="grid md:grid-cols-2 gap-2 text-xs text-gray-11">
                          <div>Started: {formatUptime(diag().uptimeMs)}</div>
                          <div>Read-only: {diag().readOnly ? "true" : "false"}</div>
                          <div>
                            Approval: {diag().approval.mode} ({diag().approval.timeoutMs}ms)
                          </div>
                          <div>Workspaces: {diag().workspaceCount}</div>
                          <div>Active workspace: {diag().activeWorkspaceId ?? "—"}</div>
                          <div>Config path: {diag().server.configPath ?? "default"}</div>
                          <div>Token source: {diag().tokenSource.client}</div>
                          <div>Host token source: {diag().tokenSource.host}</div>
                        </div>
                      )}
                    </Show>
                  </div>

                  <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-sm font-medium text-gray-12">{translate("settings.server_capabilities_title")}</div>
                      <div class="text-[11px] text-gray-8 font-mono truncate">
                        {props.openworkServerWorkspaceId ? `Worker ${props.openworkServerWorkspaceId}` : translate("settings.worker_unresolved")}
                      </div>
                    </div>
                    <Show
                      when={props.openworkServerCapabilities}
                      fallback={<div class="text-xs text-gray-9">{translate("settings.capabilities_unavailable")}</div>}
                    >
                      {(caps) => (
                        <div class="grid md:grid-cols-2 gap-2 text-xs text-gray-11">
                          <div>Skills: {formatCapability(caps().skills)}</div>
                          <div>Plugins: {formatCapability(caps().plugins)}</div>
                          <div>MCP: {formatCapability(caps().mcp)}</div>
                          <div>Commands: {formatCapability(caps().commands)}</div>
                          <div>Config: {formatCapability(caps().config)}</div>
                          <div>Proxy (OpenCodeRouter): {caps().proxy?.opencodeRouter ? "enabled" : "disabled"}</div>
                          <div>
                            Browser tools: {(() => {
                              const browser = caps().toolProviders?.browser;
                              if (!browser?.enabled) return "disabled";
                              return `${browser.mode} · ${browser.placement}`;
                            })()}
                          </div>
                          <div>
                            File tools: {(() => {
                              const files = caps().toolProviders?.files;
                              if (!files) return "Unavailable";
                              const parts = [files.injection ? "inbox on" : "inbox off", files.outbox ? "outbox on" : "outbox off"];
                              return parts.join(" · ");
                            })()}
                          </div>
                          <div>
                            Sandbox: {(() => {
                              const sandbox = caps().sandbox;
                              return sandbox
                                ? `${sandbox.backend} (${sandbox.enabled ? "on" : "off"})`
                                : "Unavailable";
                            })()}
                          </div>
                        </div>
                      )}
                    </Show>
                  </div>

                  <div class="grid md:grid-cols-2 gap-4">
                    <div class="bg-gray-1 border border-gray-6 rounded-xl p-4">
                      <div class="text-xs text-gray-10 mb-2">{translate("settings.pending_permissions_label")}</div>
                      <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-64 overflow-auto">
                        {props.safeStringify(props.pendingPermissions)}
                      </pre>
                    </div>
                    <div class="bg-gray-1 border border-gray-6 rounded-xl p-4">
                      <div class="text-xs text-gray-10 mb-2">{translate("settings.recent_events_label")}</div>
                      <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-64 overflow-auto">
                        {props.safeStringify(props.events)}
                      </pre>
                    </div>
                  </div>

                  <div class="bg-gray-1 border border-gray-6 rounded-xl p-4">
                    <div class="flex items-center justify-between gap-3 mb-2">
                      <div class="text-xs text-gray-10">{translate("settings.workspace_debug_events")}</div>
                      <Button
                        variant="outline"
                        class="text-xs h-7 py-0 px-2 shrink-0"
                        onClick={props.clearWorkspaceDebugEvents}
                        disabled={props.busy}
                      >
                        {translate("settings.clear")}
                      </Button>
                    </div>
                    <pre class="text-xs text-gray-12 whitespace-pre-wrap break-words max-h-64 overflow-auto">
                      {props.safeStringify(props.workspaceDebugEvents)}
                    </pre>
                  </div>

                  <div class="bg-gray-1 p-4 rounded-xl border border-gray-6 space-y-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-sm font-medium text-gray-12">{translate("settings.audit_log_title")}</div>
                      <div class={`text-xs px-2 py-1 rounded-full border ${openworkAuditStatusStyle()}`}>
                        {openworkAuditStatusLabel()}
                      </div>
                    </div>
                    <Show when={props.openworkAuditError}>
                      <div class="text-xs text-red-11">{props.openworkAuditError}</div>
                    </Show>
                    <Show
                      when={props.openworkAuditEntries.length > 0}
                      fallback={<div class="text-xs text-gray-9">{translate("settings.no_audit_entries")}</div>}
                    >
                      <div class="divide-y divide-gray-6/50">
                        <For each={props.openworkAuditEntries}>
                          {(entry) => (
                            <div class="flex items-start justify-between gap-4 py-2">
                              <div class="min-w-0">
                                <div class="text-sm text-gray-12 truncate">{entry.summary}</div>
                                <div class="text-[11px] text-gray-9 truncate">
                                  {entry.action} · {entry.target} · {formatActor(entry)}
                                </div>
                              </div>
                              <div class="text-[11px] text-gray-9 whitespace-nowrap">
                                {entry.timestamp ? formatRelativeTime(entry.timestamp) : "—"}
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </section>
          </Show>
        </Match>
      </Switch>
    </section>
  );
}
