import React, { useState } from 'react';
import FamilyTree from './components/FamilyTree';
import ReviewPanel from './components/ReviewPanel';
import MemberForm from './components/MemberForm';
import Header from './components/Header';
import { useFamilyTree } from './hooks/useFamilyTree';
import './App.css';

function App() {
  const {
    members,
    pendingReviews,
    addMember,
    updateMember,
    deleteMember,
    approveMember,
    rejectMember,
  } = useFamilyTree();

  const [view, setView] = useState('tree');
  const [editingMember, setEditingMember] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function handleAddMember(data) {
    addMember(data);
    setShowForm(false);
  }

  function handleEditMember(member) {
    setEditingMember(member);
    setShowForm(true);
  }

  function handleUpdateMember(data) {
    updateMember(editingMember.id, data);
    setEditingMember(null);
    setShowForm(false);
  }

  function handleCloseForm() {
    setEditingMember(null);
    setShowForm(false);
  }

  return (
    <div className="app">
      <Header
        view={view}
        onViewChange={setView}
        pendingCount={pendingReviews.length}
        onAddMember={() => setShowForm(true)}
      />

      <main className="app-main">
        {view === 'tree' && (
          <FamilyTree
            members={members}
            onEdit={handleEditMember}
            onDelete={deleteMember}
          />
        )}

        {view === 'review' && (
          <ReviewPanel
            pendingReviews={pendingReviews}
            onApprove={approveMember}
            onReject={rejectMember}
          />
        )}
      </main>

      {showForm && (
        <MemberForm
          member={editingMember}
          members={members}
          onSubmit={editingMember ? handleUpdateMember : handleAddMember}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}

export default App;
