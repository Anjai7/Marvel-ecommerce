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

/** Fixed order so the global `error` is deterministic. */
const COLLECTION_KEYS = ["hero", "banners", "categories", "categoryTree", "footer", "menu"];

const emptyErrors = () => COLLECTION_KEYS.reduce((errors, key) => ({ ...errors, [key]: null }), {});

/** The first collection error, in `COLLECTION_KEYS` order. */
const firstError = (errors) => COLLECTION_KEYS.map((key) => errors?.[key]).find(Boolean) ?? null;

const INITIAL_STATE = {
  hero: [],
  banners: [],
  categories: [],
  categoryTree: [],
  footer: EMPTY_FOOTER,
  menu: [],
  loading: true,
  error: null,
  errors: emptyErrors(),
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

    const results = { hero, banners, categories, categoryTree, footer, menu };
    const errors = COLLECTION_KEYS.reduce(
      (acc, key) => ({ ...acc, [key]: results[key].error ? messageOf(results[key].error) : null }),
      {}
    );

    setState((previous) => {
      // A menu-only refresh that started later owns both the value and its error.
      const menuFresh = menuRequest === menuRequestRef.current;
      const nextErrors = { ...errors, menu: menuFresh ? errors.menu : previous.errors.menu };

      return {
        hero: hero.error ? [] : asList(hero.value?.slides),
        banners: banners.error ? [] : asList(banners.value?.banners),
        categories: categories.error ? [] : asList(categories.value?.categories),
        categoryTree: categoryTree.error ? [] : asList(categoryTree.value?.categories),
        footer: footer.error
          ? EMPTY_FOOTER
          : { sections: asList(footer.value?.sections), links: asList(footer.value?.links) },
        menu: menuFresh ? (menu.error ? [] : asList(menu.value)) : previous.menu,
        loading: false,
        error: firstError(nextErrors),
        errors: nextErrors,
      };
    });
  }, []);

  /** Role changes only affect the role-scoped menu, so nothing else reloads. */
  const refreshMenu = useCallback(async (nextRole) => {
    const menuRequest = ++menuRequestRef.current;
    const result = await settle(apiFetchMenuItems(nextRole));

    if (!aliveRef.current || menuRequest !== menuRequestRef.current) return;

    setState((previous) => {
      const nextErrors = {
        ...previous.errors,
        menu: result.error ? messageOf(result.error) : null,
      };

      return {
        ...previous,
        menu: result.error ? [] : asList(result.value),
        error: firstError(nextErrors),
        errors: nextErrors,
      };
    });
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

  // Any admin editor's write triggers a refresh. Editors currently dispatch
  // either event, so both are wired (belt and braces, not a single point of
  // failure); Task 17 will make the menu editor dispatch both.
  useEffect(() => {
    const handleUpdated = () => {
      load();
    };
    window.addEventListener("marvel_content_updated", handleUpdated);
    window.addEventListener("marvel_menu_updated", handleUpdated);
    return () => {
      window.removeEventListener("marvel_content_updated", handleUpdated);
      window.removeEventListener("marvel_menu_updated", handleUpdated);
    };
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
