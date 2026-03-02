import React, { useState } from 'react';
import "./App.css";
import logo from "./assets/logo.png";

  return (
    <div className="App">
      <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <main>
        {/* 主内容区域 - 根据您的图片描述创建 */}
        <div className="main-content">
          {/* 英雄区域 */}
          <section className="hero-section">
            <div className="container">
              <div className="hero-content">
                <h1 className="main-title">YUZIBRIDGE SaaS 企业云服务</h1>
                <p className="subtitle">高效·安全·智能的企业软件解决方案</p>
              </div>
            </div>
          </section>

        <nav className="nav">
          <a href="#" className="nav-item active">
            首页
          </a>
          <a href="#" className="nav-item">
            产品
          </a>
          <a href="#" className="nav-item">
            服务
          </a>
          <a href="#" className="nav-item">
            关于我们
          </a>
          <a href="#" className="nav-item">
            联系我们
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">YUZIBRIDGE SaaS 企业云服务</h1>
        <p className="hero-subtitle">高效 · 安全 · 智能的企业软件解决方案</p>
      </section>
    </div>
  );
}

export default App;