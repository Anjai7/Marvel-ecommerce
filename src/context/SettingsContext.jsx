import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetchSettings } from "../api/settingsApi";
import { configureCurrency } from "../lib/currency";

const SettingsContext = createContext(null);

const INITIAL_STATE = { settings: {}, loading: true, error: null };

/**
 * A proxy-safe value for a surface rendered without the provider (an isolated
 * component test, or a screen mounted before the provider exists). Every
 * consumer already treats missing settings as "render nothing", so returning
 * an empty map keeps the storefront on screen instead of crashing it.
 */
const NO_SETTINGS = Object.freeze({
  settings: {},
  loading: false,
  error: null,
  refresh: () => {},
});

/** The API returns `{ settings: { <key>: value } }`; anything else is empty. */
const asSettings = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

function messageOf(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Failed to load settings.";
}

/**
 * Loads the backend-owned settings once and shares them with every surface.
 *
 * The settings are not optional content: currency, shipping threshold, footer
 * chrome and the hero rescue slide all read from here. A failed request never
 * throws — the map stays empty and each consumer renders nothing.
 */
export function SettingsProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);
  const aliveRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;

    try {
      const payload = await apiFetchSettings();
      if (!aliveRef.current || request !== requestRef.current) return;

      const settings = asSettings(payload?.settings);
      // Every amount on screen formats through this module; point it at the
      // backend's currency before the new settings are rendered.
      configureCurrency(settings.currency);
      setState({ settings, loading: false, error: null });
    } catch (error) {
      if (!aliveRef.current || request !== requestRef.current) return;
      setState({ settings: {}, loading: false, error: messageOf(error) });
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  // The admin settings editor dispatches the content-update event as well, so
  // both are wired (same belt-and-braces pattern as ContentContext).
  useEffect(() => {
    const handleUpdated = () => {
      load();
    };
    window.addEventListener("marvel_settings_updated", handleUpdated);
    window.addEventListener("marvel_content_updated", handleUpdated);
    return () => {
      window.removeEventListener("marvel_settings_updated", handleUpdated);
      window.removeEventListener("marvel_content_updated", handleUpdated);
    };
  }, [load]);

  const value = useMemo(() => ({ ...state, refresh: load }), [state, load]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext) ?? NO_SETTINGS;
}
