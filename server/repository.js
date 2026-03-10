function toYear(value) {
  const year = Number(value);
  if (!year || Number.isNaN(year)) {
    return null;
  }
  return year;
}

function toName(given, surname) {
  return `${given || ""} ${surname || ""}`.trim() || "Sem nome";
}

function toCoordinate(value) {
  const raw = Number(value);
  if (!raw || Number.isNaN(raw)) {
    return null;
  }

  return raw / 10000000;
}

class GenealogyRepository {
  constructor(db) {
    this.db = db;
  }

  health() {
    const result = this.db.prepare("SELECT 1 AS ok").get();
    return result?.ok === 1;
  }

  searchPeople(query, limit = 20) {
    const normalized = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `
      SELECT
        p.PersonID AS id,
        p.Sex AS sex,
        n.Given AS given,
        n.Surname AS surname,
        n.BirthYear AS birthYear,
        n.DeathYear AS deathYear
      FROM PersonTable p
      LEFT JOIN NameTable n
        ON n.OwnerID = p.PersonID
       AND n.IsPrimary = 1
      WHERE
        (COALESCE(n.Given, '') || ' ' || COALESCE(n.Surname, '')) COLLATE NOCASE LIKE @q
        OR COALESCE(n.Given, '') COLLATE NOCASE LIKE @q
        OR COALESCE(n.Surname, '') COLLATE NOCASE LIKE @q
      ORDER BY
        CASE WHEN n.BirthYear > 0 THEN n.BirthYear ELSE 9999 END ASC,
        n.Surname COLLATE NOCASE ASC,
        n.Given COLLATE NOCASE ASC
      LIMIT @limit
    `
      )
      .all({ q: normalized, limit });

    return rows.map((row) => ({
      id: Number(row.id),
      name: toName(row.given, row.surname),
      given: row.given || "",
      surname: row.surname || "",
      birthYear: toYear(row.birthYear),
      deathYear: toYear(row.deathYear),
      sex: row.sex ?? null,
    }));
  }

  getPersonSummary(personId) {
    const row = this.db
      .prepare(
        `
      SELECT
        p.PersonID AS id,
        p.Sex AS sex,
        p.Living AS living,
        n.Given AS given,
        n.Surname AS surname,
        n.BirthYear AS birthYear,
        n.DeathYear AS deathYear
      FROM PersonTable p
      LEFT JOIN NameTable n
        ON n.OwnerID = p.PersonID
       AND n.IsPrimary = 1
      WHERE p.PersonID = ?
      LIMIT 1
    `
      )
      .get(personId);

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      name: toName(row.given, row.surname),
      given: row.given || "",
      surname: row.surname || "",
      birthYear: toYear(row.birthYear),
      deathYear: toYear(row.deathYear),
      sex: row.sex ?? null,
      living: row.living ?? null,
    };
  }

  getAllPeople() {
    const rows = this.db
      .prepare(
        `
      SELECT
        p.PersonID AS id,
        p.Sex AS sex,
        p.Living AS living,
        n.Given AS given,
        n.Surname AS surname,
        n.BirthYear AS birthYear,
        n.DeathYear AS deathYear
      FROM PersonTable p
      LEFT JOIN NameTable n
        ON n.OwnerID = p.PersonID
       AND n.IsPrimary = 1
      ORDER BY p.PersonID ASC
    `
      )
      .all();

    return rows.map((row) => ({
      id: Number(row.id),
      name: toName(row.given, row.surname),
      given: row.given || "",
      surname: row.surname || "",
      birthYear: toYear(row.birthYear),
      deathYear: toYear(row.deathYear),
      sex: row.sex ?? null,
      living: row.living ?? null,
    }));
  }

  getParentLinks() {
    const rows = this.db
      .prepare(
        `
      SELECT DISTINCT c.ChildID AS childId, f.FatherID AS parentId, 'father' AS relation
      FROM ChildTable c
      JOIN FamilyTable f ON f.FamilyID = c.FamilyID
      WHERE c.ChildID > 0 AND f.FatherID > 0
      UNION ALL
      SELECT DISTINCT c.ChildID AS childId, f.MotherID AS parentId, 'mother' AS relation
      FROM ChildTable c
      JOIN FamilyTable f ON f.FamilyID = c.FamilyID
      WHERE c.ChildID > 0 AND f.MotherID > 0
    `
      )
      .all();

    return rows.map((row) => ({
      childId: Number(row.childId),
      parentId: Number(row.parentId),
      relation: row.relation,
    }));
  }

  getPersonEvents() {
    const rows = this.db
      .prepare(
        `
      SELECT
        e.EventID AS eventId,
        e.OwnerID AS personId,
        e.EventType AS eventTypeId,
        e.Date AS dateRaw,
        e.SortDate AS sortDate,
        e.PlaceID AS placeId,
        pl.Name AS placeName,
        pl.Latitude AS latitude,
        pl.Longitude AS longitude,
        ft.Name AS eventTypeName
      FROM EventTable e
      LEFT JOIN PlaceTable pl ON pl.PlaceID = e.PlaceID
      LEFT JOIN FactTypeTable ft ON ft.FactTypeID = e.EventType
      WHERE e.OwnerType = 0
      ORDER BY e.SortDate ASC
    `
      )
      .all();

    return rows.map((row) => ({
      eventId: Number(row.eventId),
      personId: Number(row.personId),
      eventTypeId: Number(row.eventTypeId),
      eventType: row.eventTypeName || `Type-${row.eventTypeId}`,
      dateRaw: row.dateRaw || "",
      sortDate: Number(row.sortDate) || null,
      placeId: row.placeId ? Number(row.placeId) : null,
      placeName: row.placeName || null,
      lat: toCoordinate(row.latitude),
      lon: toCoordinate(row.longitude),
    }));
  }
}

module.exports = {
  GenealogyRepository,
};
