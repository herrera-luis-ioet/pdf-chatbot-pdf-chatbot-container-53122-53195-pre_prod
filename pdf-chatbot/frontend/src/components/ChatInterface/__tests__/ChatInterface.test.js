import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import jest from 'jest-mock';
import '@testing-library/jest-dom';
import ChatInterface from '../ChatInterface';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

const mockIo = jest.fn(() => mockSocket);

jest.mock('socket.io-client', () => ({
  __esModule: true,
  io: mockIo,
}));

// Import socket.io-client mock
import { io } from 'socket.io-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Setup socket mock
io.mockImplementation(() => mockSocket);

describe('ChatInterface', () => {
  let component;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset fetch mock
    mockFetch.mockReset();
    // Reset socket mock
    mockSocket.on.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.disconnect.mockReset();
  });

  afterEach(() => {
    // Clean up socket connection and component after each test
    if (component) {
      component.unmount();
    }
    mockSocket.disconnect();
  });

  describe('Initial Rendering', () => {
    it('should render input field and send button when PDF ID is provided', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });
      
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
    });

    it('should disable input and button when no PDF ID is provided', async () => {
      await act(async () => {
        component = render(<ChatInterface />);
      });
      
      expect(screen.getByTestId('message-input')).toBeDisabled();
      expect(screen.getByTestId('send-button')).toBeDisabled();
    });
  });

  describe('Chat History Loading', () => {
    it('should fetch and display chat history when PDF ID is provided', async () => {
      const mockMessages = {
        messages: [
          { content: 'Hello', type: 'user', timestamp: '2023-01-01T12:00:00Z' },
          { content: 'Hi there!', type: 'bot', timestamp: '2023-01-01T12:00:01Z' }
        ]
      };

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessages)
        })
      );

      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      // Wait for loading state
      expect(screen.getByText(/Loading chat history/i)).toBeInTheDocument();

      // Wait for messages to appear
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/123/history');
      expect(screen.queryByText(/Loading chat history/i)).not.toBeInTheDocument();
    });

    it('should display error message when chat history fetch fails', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );

      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish socket connection when PDF ID is provided', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      expect(io).toHaveBeenCalledWith('/', {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });
      
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('chat_response', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should cleanup socket connection on unmount', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      await act(async () => {
        component.unmount();
      });

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle socket connection and disconnection with proper UI feedback', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      // Get event handlers
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];

      // Simulate socket connection
      await act(async () => {
        connectHandler();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join', { pdf_id: '123' });
      expect(screen.getByTestId('message-input')).not.toBeDisabled();
      expect(screen.queryByText(/Connection lost/)).not.toBeInTheDocument();

      // Simulate socket disconnection
      await act(async () => {
        disconnectHandler();
      });

      expect(screen.getByTestId('message-input')).toBeDisabled();
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
    });

    it('should handle reconnection attempts with proper UI feedback', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      const reconnectAttemptHandler = mockSocket.on.mock.calls.find(call => call[0] === 'reconnect_attempt')[1];
      const reconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'reconnect')[1];

      // Simulate initial connection
      await act(async () => {
        connectHandler();
      });

      // Simulate disconnection
      await act(async () => {
        disconnectHandler();
      });

      // Simulate reconnection attempts
      await act(async () => {
        reconnectAttemptHandler(1);
      });

      expect(screen.getByText(/Retry attempt 1 of 5/)).toBeInTheDocument();

      // Simulate successful reconnection
      await act(async () => {
        reconnectHandler();
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(mockSocket.emit).toHaveBeenLastCalledWith('join', { pdf_id: '123' });
      expect(screen.queryByText(/Retry attempt/)).not.toBeInTheDocument();
    });

    it('should handle connection errors with proper UI feedback', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      const connectErrorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];

      // Simulate connection error
      await act(async () => {
        connectErrorHandler(new Error('Failed to connect to server'));
      });

      expect(screen.getByText(/Connection error: Failed to connect to server/)).toBeInTheDocument();
    });

    it('should handle maximum reconnection attempts', async () => {
      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      const reconnectAttemptHandler = mockSocket.on.mock.calls.find(call => call[0] === 'reconnect_attempt')[1];

      // Simulate max reconnection attempts
      await act(async () => {
        reconnectAttemptHandler(5);
      });

      expect(screen.getByText(/Maximum reconnection attempts reached/)).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      );

      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Simulate socket connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      await act(async () => {
        connectHandler();
      });
    });

    it('should send message via WebSocket and display response', async () => {
      const input = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');

      // Type message
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
      });

      // Send message
      await act(async () => {
        fireEvent.click(sendButton);
      });

      // Verify message is displayed and thinking state
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();

      const chatResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'chat_response')[1];
      const timestamp = new Date().toISOString();

      // Simulate bot response
      await act(async () => {
        chatResponseHandler({
          pdf_id: '123',
          response: 'Bot response',
          timestamp
        });
      });

      // Verify response and UI state
      expect(screen.getByText('Bot response')).toBeInTheDocument();
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
      expect(input.value).toBe('');
      
      // Verify socket emit
      expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
        pdf_id: '123',
        message: 'Test message'
      });
    });

    it('should handle multiple messages in sequence', async () => {
      const input = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');
      const chatResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'chat_response')[1];

      // Send first message
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Message 1' } });
        fireEvent.click(sendButton);
      });

      await act(async () => {
        chatResponseHandler({
          pdf_id: '123',
          response: 'Response 1',
          timestamp: new Date().toISOString()
        });
      });

      // Send second message
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Message 2' } });
        fireEvent.click(sendButton);
      });

      await act(async () => {
        chatResponseHandler({
          pdf_id: '123',
          response: 'Response 2',
          timestamp: new Date().toISOString()
        });
      });

      expect(screen.getByText('Message 1')).toBeInTheDocument();
      expect(screen.getByText('Response 1')).toBeInTheDocument();
      expect(screen.getByText('Message 2')).toBeInTheDocument();
      expect(screen.getByText('Response 2')).toBeInTheDocument();
    });

    it('should handle socket error when sending message', async () => {
      const input = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);
      });

      // Simulate error response via WebSocket
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      await act(async () => {
        errorHandler({ message: 'Failed to process message' });
      });

      expect(screen.getByText('Failed to process message')).toBeInTheDocument();
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });

    it('should not send empty messages', async () => {
      const input = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');

      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.click(sendButton);
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      );

      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      await act(async () => {
        connectHandler();
      });
    });

    it('should handle server error during history fetch with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ messages: [{ content: 'Test message', type: 'user' }] })
        });

      await act(async () => {
        component.rerender(<ChatInterface pdfId="123" />);
      });

      // First attempt fails
      await waitFor(() => {
        expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      await act(async () => {
        fireEvent.click(retryButton);
      });

      // Second attempt succeeds
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('should handle rate limiting errors', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i}`);
      
      await act(async () => {
        messages.forEach(msg => {
          fireEvent.change(screen.getByTestId('message-input'), { target: { value: msg } });
          fireEvent.click(screen.getByTestId('send-button'));
        });
      });

      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      await act(async () => {
        errorHandler({ message: 'Rate limit exceeded. Please wait before sending more messages.' });
      });

      expect(screen.getByText('Rate limit exceeded. Please wait before sending more messages.')).toBeInTheDocument();
      expect(screen.getByTestId('message-input')).toBeDisabled();
      expect(screen.getByTestId('send-button')).toBeDisabled();

      // Wait for rate limit to expire
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
      });

      expect(screen.getByTestId('message-input')).not.toBeDisabled();
      expect(screen.getByTestId('send-button')).not.toBeDisabled();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(5000); // 5000 characters
      
      await act(async () => {
        fireEvent.change(screen.getByTestId('message-input'), { target: { value: longMessage } });
        fireEvent.click(screen.getByTestId('send-button'));
      });

      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      await act(async () => {
        errorHandler({ message: 'Message exceeds maximum length' });
      });

      expect(screen.getByText('Message exceeds maximum length')).toBeInTheDocument();
    });

    it('should handle socket reconnection with message queue', async () => {
      const message = 'Test message during disconnect';
      
      // Simulate disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      await act(async () => {
        disconnectHandler();
      });

      // Try to send message during disconnection
      await act(async () => {
        fireEvent.change(screen.getByTestId('message-input'), { target: { value: message } });
        fireEvent.click(screen.getByTestId('send-button'));
      });

      expect(screen.getByText('Message will be sent when connection is restored')).toBeInTheDocument();

      // Simulate reconnection
      const reconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'reconnect')[1];
      await act(async () => {
        reconnectHandler();
      });

      // Verify queued message is sent
      expect(mockSocket.emit).toHaveBeenCalledWith('chat_message', {
        pdf_id: '123',
        message
      });
    });

    it('should handle concurrent socket events', async () => {
      const chatResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'chat_response')[1];
      
      // Send multiple messages rapidly
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          fireEvent.change(screen.getByTestId('message-input'), { target: { value: `Message ${i}` } });
          fireEvent.click(screen.getByTestId('send-button'));
          // Simulate immediate response
          chatResponseHandler({
            pdf_id: '123',
            response: `Response ${i}`,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Verify all messages and responses are displayed in correct order
      for (let i = 0; i < 5; i++) {
        expect(screen.getByText(`Message ${i}`)).toBeInTheDocument();
        expect(screen.getByText(`Response ${i}`)).toBeInTheDocument();
      }
    });

    it('should handle invalid PDF ID', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
      );

      await act(async () => {
        component.rerender(<ChatInterface pdfId="invalid_id" />);
      });

      await waitFor(() => {
        expect(screen.getByText('PDF not found. Please upload a valid PDF file.')).toBeInTheDocument();
      });
    });
  });

  describe('UI Feedback', () => {
    it('should show loading state while sending message', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      );

      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      // Simulate socket connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      await act(async () => {
        connectHandler();
      });

      const input = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);
      });

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();

      // Simulate response
      const chatResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'chat_response')[1];
      await act(async () => {
        chatResponseHandler({
          pdf_id: '123',
          response: 'Bot response',
          timestamp: new Date().toISOString()
        });
      });

      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });

    it('should clear input after sending message', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      );

      await act(async () => {
        component = render(<ChatInterface pdfId="123" />);
      });

      // Simulate socket connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      await act(async () => {
        connectHandler();
      });

      const input = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);
      });

      expect(input.value).toBe('');
    });
  });
});
