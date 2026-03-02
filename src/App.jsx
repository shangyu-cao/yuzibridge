import React, { useState } from 'react';
import "./App.css";
import Header from './yuzibridge/Header';
import Footer from './yuzibridge/Footer';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

          {/* 功能模块区域 */}
          <section className="features-section">
            <div className="container">
              <div className="features-grid">
                {/* 功能卡片1：云协作平台 */}
                <div className="feature-card">
                  <div className="feature-icon-wrapper">
                    <span className="feature-icon">👥</span>
                  </div>
                  <h3 className="feature-title">云协作平台</h3>
                  <p className="feature-description">团队实时协作·文档同步共享</p>
                </div>

                {/* 功能卡片2：数据可视化 */}
                <div className="feature-card">
                  <div className="feature-icon-wrapper">
                    <span className="feature-icon">📊</span>
                  </div>
                  <h3 className="feature-title">数据可视化</h3>
                  <p className="feature-description">多维度分析·直观报表展示</p>
                </div>

                {/* 功能卡片3：安全运维 */}
                <div className="feature-card">
                  <div className="feature-icon-wrapper">
                    <span className="feature-icon">🛡️</span>
                  </div>
                  <h3 className="feature-title">安全运维</h3>
                  <p className="feature-description">企业级加密·7 * 24小时监控</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;