import type { ReactNode } from "react";
import type { Page } from "../App.tsx";

interface LayoutProps {
  page: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Home", icon: "⬡" },
  { id: "ai", label: "Solomon", icon: "◈" },
  { id: "apps", label: "Apps", icon: "⊞" },
  { id: "files", label: "Files", icon: "⊟" },
];

export default function Layout({ page, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-ark-bg text-ark-text overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-ark-surface border-r border-ark-border shrink-0">
        <div className="p-6 border-b border-ark-border">
          <div className="flex items-center gap-3">
            <span className="text-3xl text-ark-accent">⬡</span>
            <div>
              <div className="font-semibold text-lg tracking-tight">Ark Node</div>
              <div className="text-xs text-ark-muted">v0.2.0</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150 focus-visible:outline-ark-accent ${
                page === item.id
                  ? "bg-ark-accent/20 text-ark-accent-glow font-medium"
                  : "text-ark-text-dim hover:bg-ark-card hover:text-ark-text"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-ark-border">
          <div className="text-xs text-ark-muted text-center">Your data. Your intelligence.</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Bottom tab bar — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-ark-surface/90 backdrop-blur-xl border-t border-ark-border z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all min-w-[60px] ${
                page === item.id
                  ? "text-ark-accent"
                  : "text-ark-muted"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
