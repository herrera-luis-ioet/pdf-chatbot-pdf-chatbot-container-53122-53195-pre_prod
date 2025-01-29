const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

export const io = jest.fn(() => mockSocket);
export default { io };