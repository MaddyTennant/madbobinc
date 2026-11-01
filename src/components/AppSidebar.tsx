"use client";

/**
 * AppSidebar
 * -----------
 * Collapsible sidebar adapted from a Claude-style template: a primary "new
 * chat" action, this app's real nav destinations, a scrollable conversation
 * history grouped by recency, and a user menu pinned to the bottom.
 *
 * Adapted from the original drop-in version: no workspace switcher (this
 * app is single-workspace per session), no dark mode, and colors mapped
 * onto this app's own stone/paper/brand Tailwind tokens instead of the
 * template's placeholder neutral/emerald palette.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Vertical } from "@prisma/client";
import {
  ChevronsLeft,
  ChevronsRight,
  Plus,
  MessageSquare,
  LayoutDashboard,
  BellRing,
  Wallet,
  Store,
  FileBarChart,
  Plug,
  Users,
  LogOut,
  MoreVertical,
  Trash2,
  Building2,
  User as UserIcon,
  PackageSearch,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../app/(auth)/actions";
import { deleteConversationAction } from "../app/(app)/query/actions";

export interface HistoryItem {
  id: string;
  title: string;
  updatedAt: string; // ISO date
  href: string;
}

export interface AppSidebarProps {
  workspaceName: string;
  history: HistoryItem[];
  user: { name: string; role: string };
  vertical: Vertical;
}

const NAV_ITEMS = [
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/insights", label: "Insights & Alerts", icon: BellRing },
  { href: "/budgets", label: "Budgets & Approvals", icon: Wallet },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings/workspace", label: "Workspace", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
] as const;

// Only relevant to the Tech vertical (backed by the Renovate connector) —
// see VERTICAL_CONNECTOR_TYPES in src/lib/connectors.ts.
const TECH_NAV_ITEM = { href: "/dependencies", label: "Dependencies", icon: PackageSearch } as const;

const COLLAPSE_COOKIE = "sidebar:collapsed";

function groupByRecency(items: HistoryItem[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: Record<"Today" | "Yesterday" | "Previous 7 days" | "Older", HistoryItem[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const item of items) {
    const d = new Date(item.updatedAt);
    if (d >= startOfToday) groups.Today.push(item);
    else if (d >= startOfYesterday) groups.Yesterday.push(item);
    else if (d >= sevenDaysAgo) groups["Previous 7 days"].push(item);
    else groups.Older.push(item);
  }

  return Object.entries(groups).filter(([, v]) => v.length > 0) as [string, HistoryItem[]][];
}

export default function AppSidebar({ workspaceName, history, user, vertical }: AppSidebarProps) {
  const pathname = usePathname();
  const navItems = vertical === "TECH" ? [...NAV_ITEMS, TECH_NAV_ITEM] : NAV_ITEMS;
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openChatMenu, setOpenChatMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const chatTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const chatMenuRef = useRef<HTMLDivElement | null>(null);

  // Hydrate collapse state on mount (client-only, avoids SSR mismatch). A saved cookie
  // preference always wins; with no cookie yet (first visit), default to collapsed on
  // narrow viewports as a starting suggestion.
  useEffect(() => {
    const match = document.cookie.match(new RegExp(`${COLLAPSE_COOKIE}=(true|false)`));
    if (match) setCollapsed(match[1] === "true");
    else if (window.matchMedia("(max-width: 1024px)").matches) setCollapsed(true);
  }, []);

  // Auto-collapse when the window is resized down past the breakpoint. This only fires
  // on the crossing itself (a "change" event), not continuously on every render — so it
  // won't fight a manual expand afterwards the way it used to (that was the "stuck
  // collapsed" bug: the old version force-collapsed on every render while narrow,
  // ignoring the toggle button entirely).
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px)");
    const listener = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  // Close the open chat menu on an outside click (checking both the portal-rendered
  // dropdown and its trigger button, since the dropdown no longer lives in the DOM
  // next to the button once it's portaled out to <body>).
  useEffect(() => {
    if (!openChatMenu) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const trigger = chatTriggerRefs.current[openChatMenu!.id];
      if (chatMenuRef.current?.contains(target)) return;
      if (trigger?.contains(target)) return;
      setOpenChatMenu(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openChatMenu]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${COLLAPSE_COOKIE}=${next}; path=/; max-age=31536000`;
      return next;
    });
  }

  const effectiveCollapsed = collapsed;
  const groupedHistory = useMemo(() => groupByRecency(history), [history]);

  return (
    <aside
      className={`flex h-full flex-col border-r border-stone-200 bg-paper transition-[width] duration-200 ease-in-out ${
        effectiveCollapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* Workspace header (single workspace, no switcher) */}
      <div className="flex items-center gap-3 border-b border-stone-200 px-3 py-4">
        <Logo />
        {!effectiveCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-stone-900">{workspaceName}</p>
            <p className="truncate text-xs text-stone-500">Spend AI</p>
          </div>
        )}
      </div>

      {/* New chat */}
      <div className="p-2">
        <Link
          href="/query"
          className={`flex items-center gap-3 rounded-md border border-stone-200 px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-paper-200 ${
            effectiveCollapsed ? "justify-center" : ""
          }`}
        >
          {effectiveCollapsed ? (
            <MessageSquare className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <Plus className="h-4 w-4 shrink-0" />
              <span>New chat</span>
            </>
          )}
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="px-2">
        <ul className="flex flex-col gap-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-paper-200 font-medium text-stone-900" : "text-stone-700 hover:bg-paper-200"
                  } ${effectiveCollapsed ? "justify-center" : ""}`}
                  title={effectiveCollapsed ? label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!effectiveCollapsed && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* History, grouped by recency */}
      {!effectiveCollapsed && (
        <div
          className="mt-2 flex-1 overflow-y-auto px-2 pb-2"
          onScroll={() => setOpenChatMenu(null)}
        >
          {groupedHistory.map(([label, items]) => (
            <div key={label} className="mb-3">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.id} className="group/chat relative">
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 truncate rounded-md py-2.5 pl-3 pr-8 text-sm text-stone-600 hover:bg-paper-200"
                    >
                      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full border border-stone-400" />
                      <span className="truncate">{item.title}</span>
                    </Link>

                    <button
                      ref={(el) => {
                        chatTriggerRefs.current[item.id] = el;
                      }}
                      type="button"
                      onClick={() => {
                        if (openChatMenu?.id === item.id) {
                          setOpenChatMenu(null);
                          return;
                        }
                        const rect = chatTriggerRefs.current[item.id]?.getBoundingClientRect();
                        if (!rect) return;
                        setOpenChatMenu({ id: item.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      }}
                      aria-label="Chat options"
                      className={`absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 hover:bg-paper-300 hover:text-stone-700 ${
                        openChatMenu?.id === item.id ? "bg-paper-300 text-stone-700" : "opacity-0 group-hover/chat:opacity-100"
                      }`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Chat options dropdown — rendered in a portal so it isn't clipped by the
          scrollable history list or painted over by later sibling list items. */}
      {openChatMenu &&
        createPortal(
          <div
            ref={chatMenuRef}
            style={{ position: "fixed", top: openChatMenu.top, right: openChatMenu.right }}
            className="z-50 w-32 rounded-lg border border-stone-200 bg-surface p-1 shadow-lg"
          >
            <form action={deleteConversationAction} onSubmit={() => setOpenChatMenu(null)}>
              <input type="hidden" name="id" value={openChatMenu.id} />
              <input type="hidden" name="currentPath" value={pathname ?? ""} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </form>
          </div>,
          document.body,
        )}
      {effectiveCollapsed && <div className="flex-1" />}

      {/* Collapse toggle */}
      <div className="border-t border-stone-200 p-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-stone-500 hover:bg-paper-200 ${
            effectiveCollapsed ? "justify-center" : ""
          }`}
          aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {effectiveCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* User menu */}
      <div className="relative border-t border-stone-200 p-2">
        <button
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-paper-200 ${
            effectiveCollapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
            {user.name?.[0]?.toUpperCase() ?? <UserIcon className="h-3.5 w-3.5" />}
          </span>
          {!effectiveCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-stone-800">{user.name}</span>
              <span className="block truncate text-xs text-stone-500">{user.role}</span>
            </span>
          )}
        </button>

        {userMenuOpen && (
          <div
            className={`absolute bottom-full z-20 mb-1 rounded-lg border border-stone-200 bg-surface p-1 shadow-lg ${
              effectiveCollapsed ? "left-2 w-40" : "left-2 right-2"
            }`}
          >
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-stone-700 hover:bg-paper-200"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
