"use client";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("np_theme", next ? "dark" : "light");
    } catch { /* private mode */ }
  };

  return (
    <button
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
      onClick={toggle}
      className={`microlabel w-7 h-7 rounded-full border border-line bg-card flex items-center justify-center hover:border-accent hover:text-accent transition-colors ${className}`}
    >
      <span className="theme-sun">☀</span>
      <span className="theme-moon">☾</span>
    </button>
  );
}
