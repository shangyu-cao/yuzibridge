import React from "react";

type MenuFooterProps = {
  address?: string;
  phone?: string;
  phoneLabel?: string;
};

const MenuFooter: React.FC<MenuFooterProps> = ({
  address,
  phone,
  phoneLabel = "Phone",
}) => {
  return (
    <footer className="menu-footer">
      <div className="menu-footer__left">
        {address ? <p className="menu-footer__address">{address}</p> : null}
        {phone ? <p className="menu-footer__contact">{phoneLabel}: {phone}</p> : null}
      </div>
    </footer>
  );
};

export default MenuFooter;
