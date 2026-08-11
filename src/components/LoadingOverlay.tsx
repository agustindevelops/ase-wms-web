import Image from "next/image";

export default function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-cream"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Image
        src="/images/aniah-social-events-logo.png"
        alt=""
        width={120}
        height={120}
        priority
        className="animate-logo-spin select-none"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
