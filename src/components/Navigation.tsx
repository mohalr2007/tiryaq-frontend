'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Logo } from "./Logo";
import { ChevronDown, Menu, X } from "lucide-react";

const navItems = [
  {
    label: "Services",
    children: [
      { label: "AI Assistant", sub: "Instant symptom analysis", href: "/ai-assistant" },
      { label: "Find Doctors", sub: "Browse certified specialists", href: "/doctors" },
      { label: "Availability", sub: "Real-time scheduling", href: "/availability" },
    ],
  },
  {
    label: "Community",
    href: "/community",
  },
  {
    label: "About",
    children: [
      { label: "How It Works", sub: "Our platform explained", href: "/#how-it-works" },
      { label: "Health Records", sub: "Secure medical history", href: "/records" },
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  const [active, setActive] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setActive(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const isDropdownOpen = active !== null;

  return (
    <>
      {/* Dim overlay — same as Basel */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 pointer-events-none ${
          isDropdownOpen ? "opacity-100" : "opacity-0"
        }`}
        style={{ top: 0 }}
      />

      {/* Outer wrapper — gray bg, provides the page-edge spacing */}
      <div className="sticky top-0 z-50 bg-gray-100 dark:bg-slate-950 px-4 py-3">
        {/* The floating pill nav */}
        <div
          ref={ref}
          className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-full px-6 shadow-sm border border-gray-200 dark:border-slate-800"
        >
          <div className="flex items-center h-[64px] gap-8">

            {/* Logo */}
            <Link href="/" className="shrink-0">
              <Logo size="md" />
            </Link>

            {/* Desktop nav links — centered */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {navItems.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`px-4 py-2 text-[15px] font-medium transition-colors rounded-full ${
                      pathname === item.href
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label} className="relative">
                    <button
                      onMouseEnter={() => setActive(item.label)}
                      onMouseLeave={() => setActive(null)}
                      onClick={() => setActive(active === item.label ? null : item.label)}
                      className={`flex items-center gap-1 px-4 py-2 text-[15px] font-medium transition-colors rounded-full ${
                        active === item.label
                          ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800"
                          : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {item.label}
                      <ChevronDown
                        size={14}
                        strokeWidth={2.5}
                        className={`transition-transform duration-200 ${active === item.label ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Dropdown */}
                    <div
                      onMouseEnter={() => setActive(item.label)}
                      onMouseLeave={() => setActive(null)}
                      className={`absolute top-full left-0 mt-3 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden transition-all duration-200 ${
                        active === item.label
                          ? "opacity-100 translate-y-0 pointer-events-auto"
                          : "opacity-0 -translate-y-2 pointer-events-none"
                      }`}
                    >
                      {item.children?.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex flex-col px-5 py-4 border-b border-gray-50 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800 group transition-colors"
                        >
                          <span className="text-[14px] font-semibold text-gray-900 dark:text-slate-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                            {child.label}
                          </span>
                          <span className="text-[12px] text-gray-400 dark:text-slate-400 mt-0.5">{child.sub}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              )}
            </nav>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-3 ml-auto">
              <Link
                href="/login"
                className="text-[15px] font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors px-3"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-6 py-2.5 rounded-full bg-blue-600 text-white text-[14px] font-semibold hover:bg-blue-700 transition-colors"
              >
                Get started
              </Link>
            </div>

            {/* Mobile burger */}
            <button
              className="lg:hidden ml-auto p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu — also inside the gray wrapper */}
        {mobileOpen && (
          <div className="lg:hidden max-w-7xl mx-auto mt-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 space-y-1">
              {navItems.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block px-4 py-3 text-[15px] font-medium text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label}>
                    <button
                      onClick={() =>
                        setMobileExpanded(mobileExpanded === item.label ? null : item.label)
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-[15px] font-medium text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      {item.label}
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${
                          mobileExpanded === item.label ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {mobileExpanded === item.label && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children?.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex flex-col px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <span className="text-[14px] font-semibold text-gray-900 dark:text-slate-100">{child.label}</span>
                            <span className="text-[12px] text-gray-400 dark:text-slate-400 mt-0.5">{child.sub}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-3">
                <Link
                  href="/login"
                  className="block text-center px-4 py-3 text-[15px] font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="block text-center px-4 py-3 rounded-full bg-blue-600 text-white text-[14px] font-semibold hover:bg-blue-700 transition-colors"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
