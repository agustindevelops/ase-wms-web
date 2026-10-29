"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ModalOptions = {
  title: ReactNode;
  content: ReactNode;
  confirmationLabel: string;
  onConfirm: () => void | Promise<void>;
};

type ModalContextValue = {
  showModal: (options: ModalOptions) => void;
  hideModal: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ModalOptions | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const confirmingRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const hideModal = useCallback(() => {
    setOptions(null);
  }, []);

  const showModal = useCallback((nextOptions: ModalOptions) => {
    confirmingRef.current = false;
    setConfirming(false);
    setConfirmationError(null);
    setOptions(nextOptions);
  }, []);

  const confirm = useCallback(async () => {
    if (!options || confirming) return;
    confirmingRef.current = true;
    setConfirming(true);
    setConfirmationError(null);
    try {
      await options.onConfirm();
      setOptions(null);
    } catch (cause) {
      setConfirmationError(
        cause instanceof Error ? cause.message : "The action could not be completed.",
      );
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  }, [confirming, options]);

  const isOpen = options !== null;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmingRef.current) hideModal();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [hideModal, isOpen]);

  const value = useMemo(
    () => ({ showModal, hideModal }),
    [hideModal, showModal],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      {options ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !confirming) hideModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-modal-title"
            className="w-full max-w-md rounded-2xl border border-brown-200 bg-cream p-6 shadow-xl"
          >
            <div className="flex items-start gap-4">
              <h2
                id="app-modal-title"
                className="flex-1 font-nickainley text-2xl text-coral"
              >
                {options.title}
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                disabled={confirming}
                onClick={hideModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-brown-500 transition hover:bg-brown-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-3 text-sm text-brown-700">
              {options.content}
            </div>
            {confirmationError ? (
              <p className="mt-3 text-sm text-peach-700" role="alert">
                {confirmationError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                type="button"
                disabled={confirming}
                onClick={hideModal}
                className="rounded-full bg-brown-100 px-4 py-2 text-sm font-medium text-brown-800 transition hover:bg-brown-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={() => void confirm()}
                className="rounded-full bg-peach-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-peach-600 disabled:opacity-50"
              >
                {confirming ? "Working…" : options.confirmationLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
}
