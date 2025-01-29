// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn((event, callback) => {
    if (event === 'connect') {
      setTimeout(() => callback(), 0);
    }
    return mockSocket;
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

const mockIo = jest.fn(() => mockSocket);

jest.mock('socket.io-client', () => ({
  io: mockIo,
  __esModule: true,
  default: mockIo,
}));

// Make mockSocket available globally for tests
global.mockSocket = mockSocket;
global.mockIo = mockIo;

// Mock axios
jest.mock('axios');

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.IntersectionObserver = MockIntersectionObserver;
