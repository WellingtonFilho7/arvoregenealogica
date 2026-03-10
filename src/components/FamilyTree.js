import React, { useState } from 'react';
import MemberCard from './MemberCard';
import './FamilyTree.css';

function buildTree(members) {
  const roots = members.filter((m) => !m.parentId || !members.find((p) => p.id === m.parentId));
  const childrenMap = {};
  members.forEach((m) => {
    if (m.parentId) {
      if (!childrenMap[m.parentId]) childrenMap[m.parentId] = [];
      childrenMap[m.parentId].push(m);
    }
  });
  return { roots, childrenMap };
}

function TreeNode({ member, childrenMap, depth, onEdit, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);
  const children = childrenMap[member.id] || [];

  return (
    <div className="tree-node">
      <div className="tree-node-content">
        <MemberCard
          member={member}
          onEdit={onEdit}
          onDelete={onDelete}
          hasChildren={children.length > 0}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {children.length > 0 && !collapsed && (
        <div className="tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              member={child}
              childrenMap={childrenMap}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FamilyTree({ members, onEdit, onDelete }) {
  const { roots, childrenMap } = buildTree(members);

  if (members.length === 0) {
    return (
      <div className="tree-empty">
        <p className="tree-empty-icon">🌱</p>
        <p>Nenhum membro cadastrado ainda.</p>
        <p>Clique em "Adicionar Membro" para começar.</p>
      </div>
    );
  }

  return (
    <div className="family-tree">
      <div className="tree-stats">
        <span className="stat">
          <strong>{members.length}</strong> membros
        </span>
        <span className="stat">
          <strong>{members.filter((m) => m.status === 'approved').length}</strong> aprovados
        </span>
        <span className="stat stat--pending">
          <strong>{members.filter((m) => m.status === 'pending').length}</strong> pendentes
        </span>
      </div>

      <div className="tree-roots">
        {roots.map((root) => (
          <TreeNode
            key={root.id}
            member={root}
            childrenMap={childrenMap}
            depth={0}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default FamilyTree;
