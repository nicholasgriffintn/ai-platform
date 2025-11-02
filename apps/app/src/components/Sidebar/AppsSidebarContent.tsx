import { Home, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SidebarShell } from "~/components/ui/SidebarShell";
import { cn } from "~/lib/utils";
import { useUIStore } from "~/state/stores/uiStore";
import { useDynamicApps } from "~/hooks/useDynamicApps";
import { groupAppsByCategory } from "~/components/Apps/utils";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";

export function AppsSidebarContent({ isHome = false }) {
  const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();
  const navigate = useNavigate();
  const { data: apps = [] } = useDynamicApps();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const grouped = groupAppsByCategory(apps);
    const apiCategories = grouped.map(([category]) => category);
    return ["Featured", ...apiCategories];
  }, [apps]);

  const handleCategoryClick = useCallback(
    (category: string) => {
      setSelectedCategory(category);
      const categoryElement = document.querySelector(
        `[data-category="${category}"]`,
      );
      if (categoryElement) {
        categoryElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (isMobile) {
        setSidebarVisible(false);
      }
    },
    [isMobile, setSidebarVisible],
  );

  const handleBrowseAllClick = useCallback(() => {
    setSelectedCategory(null);
    navigate("/apps");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (isMobile) {
      setSidebarVisible(false);
    }
  }, [navigate, isMobile, setSidebarVisible]);

  return (
    <SidebarShell
      visible={sidebarVisible}
      isMobile={isMobile}
      onClose={() => setSidebarVisible(false)}
      header={<SidebarHeader showCloudButton={false} />}
      footer={<SidebarFooter />}
    >
      <nav className="p-2 pb-[50px] space-y-6">
        <ul className="space-y-1">
          <li>
            <Link
              to="/"
              className={cn(
                "block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
                "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                "no-underline flex items-center",
              )}
            >
              <Home className="mr-2 h-5 w-5 flex-shrink-0" />
              <span>Back to Home</span>
            </Link>
          </li>
        </ul>

        {isHome && categories.length > 0 && (
          <div>
            <h3 className="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Categories
            </h3>
            <div className="flex flex-wrap gap-2 px-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    "border border-zinc-200 dark:border-zinc-700",
                    selectedCategory === category
                      ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                      : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        <ul className="space-y-1">
          <li>
            <button
              onClick={handleBrowseAllClick}
              className={cn(
                "block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900",
                "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                "flex items-center",
              )}
            >
              <Sparkles className="mr-2 h-5 w-5 flex-shrink-0" />
              <span>Browse All Apps</span>
            </button>
          </li>
        </ul>
      </nav>
    </SidebarShell>
  );
}
