// Mock fetch globally
global.fetch = jest.fn();

// Setup fetch mock defaults
beforeEach(() => {
  global.fetch.mockClear();
  global.fetch.mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({})
    })
  );
});

// Clean up after each test
afterEach(() => {
  global.fetch.mockClear();
});