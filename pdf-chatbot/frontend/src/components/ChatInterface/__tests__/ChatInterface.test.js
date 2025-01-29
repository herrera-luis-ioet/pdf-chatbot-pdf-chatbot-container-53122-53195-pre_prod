import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatInterface from '../ChatInterface';

// Mock fetch globally
global.fetch = jest.fn();

describe('ChatInterface', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset fetch mock
    fetch.mockReset();
  });

  describe('Initial Rendering', () => {
    it('should render input field and send button when PDF ID is provided', () => {
      render(<ChatInterface pdfId="123" />);
      
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('should disable input and button when no PDF ID is provided', () => {
      render(<ChatInterface />);
      
      expect(screen.getByPlaceholderText('Type your message...')).toBeDisabled();
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
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

      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessages)
        })
      );

      render(<ChatInterface pdfId="123" />);

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/chat/123/history');
    });

    it('should display error message when chat history fetch fails', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false
        })
      );

      render(<ChatInterface pdfId="123" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
      });
    });
  });

  describe('Message Sending', () => {
    it('should send message and display response', async () => {
      const mockResponse = {
        response: 'Bot response'
      };

      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      ).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      );

      render(<ChatInterface pdfId="123" />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Thinking...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Bot response')).toBeInTheDocument();
        expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/chat/123', expect.any(Object));
    });

    it('should display error message when sending message fails', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      ).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false
        })
      );

      render(<ChatInterface pdfId="123" />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to send message')).toBeInTheDocument();
      });
    });

    it('should not send empty messages', async () => {
      render(<ChatInterface pdfId="123" />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(sendButton);

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('UI Feedback', () => {
    it('should show loading state while sending message', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      ).mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ response: 'Bot response' })
        }), 100))
      );

      render(<ChatInterface pdfId="123" />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
        expect(input).not.toBeDisabled();
        expect(sendButton).not.toBeDisabled();
      });
    });

    it('should clear input after sending message', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] })
        })
      ).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: 'Bot response' })
        })
      );

      render(<ChatInterface pdfId="123" />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });
});