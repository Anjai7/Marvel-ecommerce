import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const [state, setState] = useState(INITIAL_STATE);
  const aliveRef = useRef(false);
  const requestRef = useRef(0);

  /**
   * Run all six reads in parallel; each settles on its own, so one failed
   * collection sets `error` without blanking the others. Never throws.
   */
  const load = useCallback(async () => {
    const request = ++requestRef.current;

    const [hero, banners, categories, categoryTree, footer, menu] = await Promise.all([
      settle(apiFetchHeroSlides()),
      settle(apiFetchBanners()),
      settle(apiFetchCategories()),
      settle(apiFetchCategoryTree()),
      settle(apiFetchFooter()),
      settle(apiFetchMenuItems()),
    ]);

    // A late response after unmount (or after a newer refresh) is discarded.
    if (!aliveRef.current || request !== requestRef.current) return;

    const failure = [hero, banners, categories, categoryTree, footer, menu].find(
      (result) => result.error
    );

    setState({
      hero: hero.error ? [] : asList(hero.value?.slides),
      banners: banners.error ? [] : asList(banners.value?.banners),
      categories: categories.error ? [] : asList(categories.value?.categories),
      categoryTree: categoryTree.error ? [] : asList(categoryTree.value?.categories),
      footer: footer.error
        ? EMPTY_FOOTER
        : { sections: asList(footer.value?.sections), links: asList(footer.value?.links) },
      menu: menu.error ? [] : asList(menu.value),
      loading: false,
      error: failure ? messageOf(failure.error) : null,
    });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

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
