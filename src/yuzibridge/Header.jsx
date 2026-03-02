// src/components/layout/Header.jsx
import React from 'react';
import logo from "../assets/logo.png";
import './Header.css';

const Header = ({ isMenuOpen, setIsMenuOpen }) => {
  return (
    <header className="header">
      <div className="container">
        <div className="nav-container">
          {/* Logo */}
        <div className="logo-container">
            <img src={logo} alt="logo" className="logo-img" />
            <span className="logo-text">YUZIBRIDGE</span>
        </div>

          {/* 导航菜单 */}
          <nav className="nav">
            <ul className="nav-list">
              {['首页', '产品', '服务', '关于我们', '联系我们'].map((item) => (
                <li key={item} className="nav-item">
                  <a
                    href={`#${item}`}
                    className="nav-link"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* 移动端菜单按钮 */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="菜单"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;