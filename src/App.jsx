import React from "react";
import "./App.css";
import logo from "./assets/logo.png";

const Home = () => {
  return (
    <div className="home">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img src={logo} alt="logo" className="logo-img" />
          <span className="logo-text">YUZIBRIDGE</span>
        </div>

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
};

export default Home;