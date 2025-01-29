import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './ChatInterface.css';

const SOCKET_CONFIG = {
  path: '/socket.io',
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
};

// PUBLIC_INTERFACE
const ChatInterface = ({ pdfId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
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
      try {
        // Initialize socket connection
        socketRef.current = io('/', SOCKET_CONFIG);

        // Socket event handlers
        socketRef.current.on('connect', () => {
          setIsConnected(true);
          setConnectionError(null);
          setRetryCount(0);
          socketRef.current.emit('join', { pdf_id: pdfId });
        });

        socketRef.current.on('disconnect', () => {
          setIsConnected(false);
          setConnectionError('Connection lost. Attempting to reconnect...');
        });

        socketRef.current.on('connect_error', (error) => {
          setConnectionError(`Connection error: ${error.message}`);
          setRetryCount((prev) => prev + 1);
        });

        socketRef.current.on('reconnect_attempt', (attemptNumber) => {
          setRetryCount(attemptNumber);
          if (attemptNumber >= SOCKET_CONFIG.reconnectionAttempts) {
            setConnectionError('Maximum reconnection attempts reached. Please refresh the page.');
          }
        });

        socketRef.current.on('reconnect', () => {
          setIsConnected(true);
          setConnectionError(null);
          setRetryCount(0);
          socketRef.current.emit('join', { pdf_id: pdfId });
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
      } catch (err) {
        setConnectionError(`Failed to initialize socket connection: ${err.message}`);
      }

      // Fetch initial chat history
      fetchChatHistory();

      // Cleanup on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.off('connect');
          socketRef.current.off('disconnect');
          socketRef.current.off('connect_error');
          socketRef.current.off('reconnect_attempt');
          socketRef.current.off('reconnect');
          socketRef.current.off('chat_response');
          socketRef.current.off('error');
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
    <div className="chat-interface" data-testid="chat-container">
      <div className="chat-messages" data-testid="message-list">
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
        {connectionError && (
          <div className="connection-error">
            {connectionError}
            {retryCount > 0 && retryCount < SOCKET_CONFIG.reconnectionAttempts && (
              <div className="retry-count">
                Retry attempt {retryCount} of {SOCKET_CONFIG.reconnectionAttempts}
              </div>
            )}
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
          data-testid="message-input"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim() || !pdfId}
          data-testid="send-button"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
