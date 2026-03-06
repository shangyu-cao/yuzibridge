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
  phoneLabel?: string;
  emailLabel?: string;
  socialLinksAriaLabel?: string;
  socialPlaceholder?: string;
};

const MenuFooter: React.FC<MenuFooterProps> = ({
  address,
  socialLinks = [],
  phone,
  email,
  phoneLabel = "Phone",
  emailLabel = "Email",
  socialLinksAriaLabel = "Social media links",
  socialPlaceholder = "Add social links in admin settings.",
}) => {
  return (
    <footer className="menu-footer">
      <div className="menu-footer__left">
        {address ? <p className="menu-footer__address">{address}</p> : null}
        {phone ? <p className="menu-footer__contact">{phoneLabel}: {phone}</p> : null}
        {email ? <p className="menu-footer__contact">{emailLabel}: {email}</p> : null}
      </div>

      <div className="menu-footer__right">
        {socialLinks.length > 0 ? (
          <ul className="menu-footer__social-list" aria-label={socialLinksAriaLabel}>
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
          <p className="menu-footer__placeholder">{socialPlaceholder}</p>
        )}
      </div>
    </footer>
  );
};

export default MenuFooter;
