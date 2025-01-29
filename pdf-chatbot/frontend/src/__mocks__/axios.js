const mockAxios = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  create: jest.fn(),
  defaults: {
    headers: {
      common: {}
    }
  }
};

export default mockAxios;