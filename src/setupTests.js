import "@testing-library/jest-dom";

const originalConsoleError = console.error;

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const message = args[0];
    if (
      typeof message === "string" &&
      message.includes("not wrapped in act")
    ) {
      return;
    }

    originalConsoleError(...args);
  });
});

afterAll(() => {
  console.error.mockRestore();
});
