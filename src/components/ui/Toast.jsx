import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { clsx } from "clsx";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, message, type = "success", duration = 3000 }) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="ui-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("ui-toast", `ui-toast-${t.type}`)}>
            <div className="ui-toast-icon">
              {t.type === "success" && <CheckCircle2 size={18} />}
              {t.type === "error" && <AlertCircle size={18} />}
              {t.type === "info" && <Info size={18} />}
            </div>
            <div className="ui-toast-body">
              {t.title && <div className="ui-toast-title">{t.title}</div>}
              {t.message && <div className="ui-toast-message">{t.message}</div>}
            </div>
            <button
              className="ui-toast-close"
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return dummy fallback if used outside provider
    return {
      addToast: ({ title, message }) => console.log("Toast:", title, message),
      removeToast: () => {},
    };
  }
  return ctx;
}
