import React from 'react';
import './MemberCard.css';

function getGenderIcon(gender) {
  if (gender === 'male') return '👨';
  if (gender === 'female') return '👩';
  return '👤';
}

function formatYears(birthYear, deathYear) {
  if (!birthYear) return '';
  if (deathYear) return `${birthYear} – ${deathYear}`;
  return `Nasc. ${birthYear}`;
}

function MemberCard({ member, onEdit, onDelete, hasChildren, collapsed, onToggle }) {
  const isPending = member.status === 'pending';

  return (
    <div className={`member-card ${isPending ? 'member-card--pending' : ''}`}>
      <div className="member-card-avatar">{getGenderIcon(member.gender)}</div>

      <div className="member-card-info">
        <div className="member-card-name">
          {member.name}
          {isPending && <span className="badge-pending">Pendente</span>}
        </div>
        <div className="member-card-years">
          {formatYears(member.birthYear, member.deathYear)}
        </div>
        {member.notes && (
          <div className="member-card-notes">{member.notes}</div>
        )}
      </div>

      <div className="member-card-actions">
        <button
          className="action-btn action-btn--edit"
          onClick={() => onEdit(member)}
          title="Editar"
        >
          ✏️
        </button>
        <button
          className="action-btn action-btn--delete"
          onClick={() => onDelete(member.id)}
          title="Remover"
        >
          🗑️
        </button>
        {hasChildren && (
          <button
            className="action-btn action-btn--toggle"
            onClick={onToggle}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}
      </div>
    </div>
  );
}

export default MemberCard;
