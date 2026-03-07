import React, { useEffect, useState } from "react";

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
  imageUrl,
  onClick,
  addButtonText = "Add",
  onAddToBasket,
}) => {
  const normalizedImageUrl = imageUrl?.trim();
  const [isImageVisible, setIsImageVisible] = useState(Boolean(normalizedImageUrl));

  useEffect(() => {
    setIsImageVisible(Boolean(normalizedImageUrl));
  }, [normalizedImageUrl]);

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
      <div className="menu-item-card__row">
        {normalizedImageUrl && isImageVisible ? (
          <img
            className="menu-item-card__image"
            src={normalizedImageUrl}
            alt={name}
            onError={() => setIsImageVisible(false)}
          />
        ) : null}

        <div className="menu-item-card__content">
          <h3 className="menu-item-card__name">{name}</h3>
          {description ? <p className="menu-item-card__description">{description}</p> : null}
          <span className="menu-item-card__price">{displayPrice}</span>
        </div>

        {onAddToBasket ? (
          <div className="menu-item-card__actions">
            <button
              type="button"
              className="menu-item-card__add-button"
              onClick={(event) => {
                event.stopPropagation();
                onAddToBasket();
              }}
              aria-label={addButtonText}
            >
              +
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default MenuItemCard;
