import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const INITIAL_MEMBERS = [
  {
    id: 'root-1',
    name: 'João Silva',
    birthYear: 1940,
    deathYear: 2010,
    gender: 'male',
    parentId: null,
    status: 'approved',
    notes: 'Patriarca da família',
  },
  {
    id: 'root-2',
    name: 'Maria Silva',
    birthYear: 1945,
    deathYear: null,
    gender: 'female',
    parentId: null,
    spouseId: 'root-1',
    status: 'approved',
    notes: 'Matriarca da família',
  },
  {
    id: 'child-1',
    name: 'Carlos Silva',
    birthYear: 1965,
    deathYear: null,
    gender: 'male',
    parentId: 'root-1',
    status: 'approved',
    notes: '',
  },
  {
    id: 'child-2',
    name: 'Ana Lima',
    birthYear: 1968,
    deathYear: null,
    gender: 'female',
    parentId: 'root-2',
    spouseId: 'child-1',
    status: 'approved',
    notes: '',
  },
  {
    id: 'grandchild-1',
    name: 'Pedro Silva',
    birthYear: 1990,
    deathYear: null,
    gender: 'male',
    parentId: 'child-1',
    status: 'pending',
    notes: 'Aguardando confirmação de dados',
  },
  {
    id: 'grandchild-2',
    name: 'Lucia Silva',
    birthYear: 1993,
    deathYear: null,
    gender: 'female',
    parentId: 'child-1',
    status: 'pending',
    notes: 'Informações a verificar',
  },
];

export function useFamilyTree() {
  const [members, setMembers] = useState(INITIAL_MEMBERS);

  const pendingReviews = members.filter((m) => m.status === 'pending');

  function addMember(data) {
    const newMember = {
      id: uuidv4(),
      ...data,
      status: 'pending',
    };
    setMembers((prev) => [...prev, newMember]);
  }

  function updateMember(id, data) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...data } : m))
    );
  }

  function deleteMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id && m.parentId !== id));
  }

  function approveMember(id) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'approved' } : m))
    );
  }

  function rejectMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return {
    members,
    pendingReviews,
    addMember,
    updateMember,
    deleteMember,
    approveMember,
    rejectMember,
  };
}
