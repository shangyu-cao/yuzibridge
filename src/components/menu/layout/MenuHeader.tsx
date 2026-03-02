import React from "react";

export type LanguageOption = {
  code: string;
  label: string;
  nativeLabel?: string;
};

type MenuHeaderProps = {
  storeName: string;
  logoUrl?: string;
  selectedLanguage: string;
  languages: LanguageOption[];
  onLanguageChange: (languageCode: string) => void;
};

const MenuHeader: React.FC<MenuHeaderProps> = ({
  storeName,
  logoUrl,
  selectedLanguage,
  languages,
  onLanguageChange,
}) => {
  return (
    <header className="menu-header">
      <div className="menu-header__brand">
        {logoUrl ? (
          <img className="menu-header__logo" src={logoUrl} alt={`${storeName} logo`} />
        ) : (
          <div className="menu-header__logo menu-header__logo--fallback" aria-hidden="true">
            {storeName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="menu-header__store-name">{storeName}</h1>
      </div>

      <div className="menu-header__language">
        <label htmlFor="menu-language-select" className="menu-header__language-label">
          Language
        </label>
        <select
          id="menu-language-select"
          className="menu-header__language-select"
          value={selectedLanguage}
          onChange={(event) => onLanguageChange(event.target.value)}
        >
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeLabel ? `${language.label} (${language.nativeLabel})` : language.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};

export default MenuHeader;
