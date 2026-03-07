import React, { useEffect, useRef } from "react";

export type MenuCategory = {
  id: string;
  name: string;
  itemCount?: number;
};

type CategorySidebarProps = {
  categories: MenuCategory[];
  activeCategoryId?: string;
  onCategorySelect: (categoryId: string) => void;
  title?: string;
};

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  activeCategoryId,
  onCategorySelect,
  title = "Categories",
}) => {
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!activeCategoryId) return;
    const activeButton = categoryButtonRefs.current[activeCategoryId];
    if (!activeButton) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    activeButton.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeCategoryId, categories.length]);

  return (
    <aside className="category-sidebar" aria-label="Menu categories">
      <h2 className="category-sidebar__title">{title}</h2>

      {categories.length === 0 ? (
        <p className="category-sidebar__empty">No categories yet.</p>
      ) : (
        <ul className="category-sidebar__list">
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;

            return (
              <li key={category.id} className="category-sidebar__item">
                <button
                  type="button"
                  ref={(node) => {
                    categoryButtonRefs.current[category.id] = node;
                  }}
                  className={`category-sidebar__button ${
                    isActive ? "category-sidebar__button--active" : ""
                  }`}
                  onClick={() => onCategorySelect(category.id)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="category-sidebar__name">{category.name}</span>
                  {typeof category.itemCount === "number" && (
                    <span className="category-sidebar__count">{category.itemCount}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};

export default CategorySidebar;
