import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './ChatInterface.css';

// PUBLIC_INTERFACE
const ChatInterface = ({ pdfId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const fetchChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat/${pdfId}/history`);
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError('Failed to load chat history');
      console.error('Error fetching chat history:', err);
    }
  }, [pdfId]); // Only pdfId needs to be in dependencies as setMessages and setError are stable

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (pdfId) {
      // Initialize socket connection
      socketRef.current = io('/', {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Socket event handlers
      socketRef.current.on('connect', () => {
        setIsConnected(true);
        socketRef.current.emit('join', { pdf_id: pdfId });
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });

      socketRef.current.on('chat_response', (data) => {
        if (data.pdf_id === pdfId) {
          setMessages(prev => [...prev, {
            content: data.response,
            type: 'bot',
            timestamp: data.timestamp
          }]);
          setIsLoading(false);
        }
      });

      socketRef.current.on('error', (data) => {
        setError(data.message);
        setIsLoading(false);
      });

      // Fetch initial chat history
      fetchChatHistory();

      // Cleanup on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [pdfId, fetchChatHistory]);


  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !pdfId || !isConnected) return;

    const newMessage = {
      content: inputMessage,
      type: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Send message via WebSocket
    socketRef.current.emit('chat_message', {
      pdf_id: pdfId,
      message: inputMessage
    });
  };

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.type}`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-content loading">Thinking...</div>
          </div>
        )}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input-form">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading || !pdfId}
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim() || !pdfId}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
