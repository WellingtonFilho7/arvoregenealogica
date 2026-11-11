export {};

const Database = require("better-sqlite3");
const { GenealogyRepository } = require("./repository");

describe("GenealogyRepository.searchPeople ranking", () => {
  let db;
  let repository;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE PersonTable (
        PersonID INTEGER PRIMARY KEY,
        Sex INTEGER
      );

      CREATE TABLE NameTable (
        OwnerID INTEGER,
        IsPrimary INTEGER,
        Given TEXT,
        Surname TEXT,
        BirthYear INTEGER,
        DeathYear INTEGER
      );

      CREATE TABLE FamilyTable (
        FamilyID INTEGER PRIMARY KEY,
        FatherID INTEGER,
        MotherID INTEGER
      );

      CREATE TABLE ChildTable (
        ChildID INTEGER,
        FamilyID INTEGER
      );
    `);

    db.exec(`
      INSERT INTO PersonTable (PersonID, Sex) VALUES
        (1, 1),
        (2, 1),
        (3, 1),
        (90, 0),
        (91, 1),
        (92, 0);

      INSERT INTO NameTable (OwnerID, IsPrimary, Given, Surname, BirthYear, DeathYear) VALUES
        (1, 1, 'Ana', 'SemPais', 1200, NULL),
        (2, 1, 'Ana', 'UmPai', 1300, NULL),
        (3, 1, 'Ana', 'DoisPais', 1400, NULL);

      INSERT INTO FamilyTable (FamilyID, FatherID, MotherID) VALUES
        (10, 90, 0),
        (11, 91, 92);

      INSERT INTO ChildTable (ChildID, FamilyID) VALUES
        (2, 10),
        (3, 11);
    `);

    repository = new GenealogyRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test("prioritizes people with more known parents over older records without ancestry", () => {
    const result = repository.searchPeople("ana", 10);
    const ids = result.map((person) => person.id);

    expect(ids).toEqual([3, 2, 1]);
  });
});
