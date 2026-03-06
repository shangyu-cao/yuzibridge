import React from "react";

type MenuItemCardProps = {
  name: string;
  description?: string;
  price: number | string;
  currency?: string;
  locale?: string;
  allergens?: string[];
  imageUrl?: string;
  onClick?: () => void;
  addButtonText?: string;
  onAddToBasket?: () => void;
};

const MenuItemCard: React.FC<MenuItemCardProps> = ({
  name,
  description,
  price,
  currency = "USD",
  locale = "en-US",
  allergens = [],
  imageUrl,
  onClick,
  addButtonText = "Add",
  onAddToBasket,
}) => {
  const displayPrice =
    typeof price === "number"
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
        }).format(price)
      : price;

  return (
    <article className="menu-item-card" onClick={onClick}>
      {imageUrl ? <img className="menu-item-card__image" src={imageUrl} alt={name} /> : null}

      <div className="menu-item-card__content">
        <div className="menu-item-card__top-row">
          <h3 className="menu-item-card__name">{name}</h3>
          <span className="menu-item-card__price">{displayPrice}</span>
        </div>

        {description ? <p className="menu-item-card__description">{description}</p> : null}

        {allergens.length > 0 ? (
          <ul className="menu-item-card__allergens" aria-label="Allergens">
            {allergens.map((allergen) => (
              <li key={allergen} className="menu-item-card__allergen-tag">
                {allergen}
              </li>
            ))}
          </ul>
        ) : null}

        {onAddToBasket ? (
          <div className="menu-item-card__actions">
            <button
              type="button"
              className="menu-item-card__add-button"
              onClick={(event) => {
                event.stopPropagation();
                onAddToBasket();
              }}
            >
              {addButtonText}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default MenuItemCard;
