import React from "react";

export type SocialLink = {
  label: string;
  url: string;
};

type MenuFooterProps = {
  address?: string;
  socialLinks?: SocialLink[];
  phone?: string;
  email?: string;
};

const MenuFooter: React.FC<MenuFooterProps> = ({
  address,
  socialLinks = [],
  phone,
  email,
}) => {
  return (
    <footer className="menu-footer">
      <div className="menu-footer__left">
        {address ? <p className="menu-footer__address">{address}</p> : null}
        {phone ? <p className="menu-footer__contact">Phone: {phone}</p> : null}
        {email ? <p className="menu-footer__contact">Email: {email}</p> : null}
      </div>

      <div className="menu-footer__right">
        {socialLinks.length > 0 ? (
          <ul className="menu-footer__social-list" aria-label="Social media links">
            {socialLinks.map((social) => (
              <li key={social.url} className="menu-footer__social-item">
                <a
                  className="menu-footer__social-link"
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="menu-footer__placeholder">Add social links in admin settings.</p>
        )}
      </div>
    </footer>
  );
};

export default MenuFooter;
