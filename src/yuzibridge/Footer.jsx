// src/components/footer/Footer.jsx
import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-info">
            {/* 版权信息 */}
            <p className="copyright">
              © 2026 YUZIBRIDGE All Rights Reserved | 企业服务热线：400-XXXX-XXX
            </p>
            
            {/* 底部链接 */}
            <div className="footer-links">
              <a href="#privacy" className="footer-link">隐私政策</a>
              <span className="separator">|</span>
              <a href="#terms" className="footer-link">服务条款</a>
              <span className="separator">|</span>
              <a href="#contact" className="footer-link">联系我们</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;