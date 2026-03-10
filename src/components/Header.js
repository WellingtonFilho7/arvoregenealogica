import React from 'react';
import './Header.css';

function Header({ view, onViewChange, pendingCount, onAddMember }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand">
          <span className="header-icon">🌳</span>
          <h1 className="header-title">Árvore Genealógica</h1>
        </div>

        <nav className="header-nav">
          <button
            className={`nav-btn ${view === 'tree' ? 'nav-btn--active' : ''}`}
            onClick={() => onViewChange('tree')}
          >
            Árvore
          </button>
          <button
            className={`nav-btn ${view === 'review' ? 'nav-btn--active' : ''}`}
            onClick={() => onViewChange('review')}
          >
            Revisão
            {pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </button>
        </nav>

        <button className="btn-add" onClick={onAddMember}>
          + Adicionar Membro
        </button>
      </div>
    </header>
  );
}

export default Header;
