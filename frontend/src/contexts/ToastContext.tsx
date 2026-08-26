import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "warning" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

type ToastContextValue = {
  push: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      push: (message: string, kind: ToastKind = "success") => {
        const id = Date.now() + Math.random();
        setToasts((current) => [...current.slice(-4), { id, message, kind }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, 4500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed end-4 top-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.kind === "error"
                ? "border-red-800 bg-red-950/90 text-red-50"
                : toast.kind === "warning"
                  ? "border-amber-800 bg-amber-950/90 text-amber-50"
                  : toast.kind === "info"
                    ? "border-sky-800 bg-sky-950/90 text-sky-50"
                    : "border-emerald-800 bg-emerald-950/90 text-emerald-50"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
