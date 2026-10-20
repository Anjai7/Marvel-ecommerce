import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  apiFetchBanners,
  apiFetchCategories,
  apiFetchCategoryTree,
  apiFetchFooter,
  apiFetchHeroSlides,
  apiFetchMenuItems,
} from "../api/contentApi";

const ContentContext = createContext(null);

const EMPTY_FOOTER = { sections: [], links: [] };

const INITIAL_STATE = {
  hero: [],
  banners: [],
  categories: [],
  categoryTree: [],
  footer: EMPTY_FOOTER,
  menu: [],
  loading: true,
  error: null,
};

const asList = (value) => (Array.isArray(value) ? value : []);

/** Settle one fetch without letting its rejection escape the loader. */
const settle = (promise) => promise.then((value) => ({ value })).catch((error) => ({ error }));

function messageOf(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Failed to load content.";
}

export function ContentProvider({ children }) {
  const { role } = useAuth();
  const [state, setState] = useState(INITIAL_STATE);
  const aliveRef = useRef(false);
  const requestRef = useRef(0);
  const menuRequestRef = useRef(0);
  const roleRef = useRef(role);
  const menuRoleRef = useRef(role);

  // Track the newest role outside render; the loader reads it at request time.
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  /**
   * Run all six reads in parallel; each settles on its own, so one failed
   * collection sets `error` without blanking the others. Never throws.
   */
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    const menuRequest = ++menuRequestRef.current;
    const menuRole = roleRef.current;
    menuRoleRef.current = menuRole;

    const [hero, banners, categories, categoryTree, footer, menu] = await Promise.all([
      settle(apiFetchHeroSlides()),
      settle(apiFetchBanners()),
      settle(apiFetchCategories()),
      settle(apiFetchCategoryTree()),
      settle(apiFetchFooter()),
      settle(apiFetchMenuItems(menuRole)),
    ]);

    // A late response after unmount (or after a newer refresh) is discarded.
    if (!aliveRef.current || request !== requestRef.current) return;

    const failure = [hero, banners, categories, categoryTree, footer, menu].find(
      (result) => result.error
    );

    setState((previous) => ({
      hero: hero.error ? [] : asList(hero.value?.slides),
      banners: banners.error ? [] : asList(banners.value?.banners),
      categories: categories.error ? [] : asList(categories.value?.categories),
      categoryTree: categoryTree.error ? [] : asList(categoryTree.value?.categories),
      footer: footer.error
        ? EMPTY_FOOTER
        : { sections: asList(footer.value?.sections), links: asList(footer.value?.links) },
      // A menu-only refresh that started later owns the menu value.
      menu:
        menuRequest === menuRequestRef.current
          ? menu.error
            ? []
            : asList(menu.value)
          : previous.menu,
      loading: false,
      error: failure ? messageOf(failure.error) : null,
    }));
  }, []);

  /** Role changes only affect the role-scoped menu, so nothing else reloads. */
  const refreshMenu = useCallback(async (nextRole) => {
    const menuRequest = ++menuRequestRef.current;
    const result = await settle(apiFetchMenuItems(nextRole));

    if (!aliveRef.current || menuRequest !== menuRequestRef.current) return;

    setState((previous) => ({
      ...previous,
      menu: result.error ? [] : asList(result.value),
      error: result.error ? messageOf(result.error) : previous.error,
    }));
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  // The server filters GET /api/menu by roles_allowed, so the signed-in role
  // must pick the menu; a logged-out visitor reads it as "user".
  useEffect(() => {
    if (menuRoleRef.current === role) return;
    menuRoleRef.current = role;
    refreshMenu(role);
  }, [role, refreshMenu]);

  // Admin editors dispatch this after a successful write.
  useEffect(() => {
    const handleContentUpdated = () => {
      load();
    };
    window.addEventListener("marvel_content_updated", handleContentUpdated);
    return () => window.removeEventListener("marvel_content_updated", handleContentUpdated);
  }, [load]);

  const value = useMemo(() => ({ ...state, refresh: load }), [state, load]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
}
