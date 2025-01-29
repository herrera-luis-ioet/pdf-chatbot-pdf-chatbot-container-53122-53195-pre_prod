import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import jest from 'jest-mock';
import '@testing-library/jest-dom';
import App from './App';
import PDFUpload from './components/PDFUpload/PDFUpload';
import ChatInterface from './components/ChatInterface/ChatInterface';

// Mock components
const MockPDFUpload = jest.fn(({ onUploadSuccess }) => (
  <div data-testid="pdf-upload-container">
    <button onClick={() => onUploadSuccess('test-pdf-id')}>
      Upload PDF
    </button>
  </div>
));

const MockChatInterface = jest.fn(({ pdfId }) => (
  <div data-testid="chat-interface-container">
    Chat Interface - PDF ID: {pdfId}
  </div>
));

// Mock modules
jest.mock('./components/PDFUpload/PDFUpload', () => ({ __esModule: true, default: MockPDFUpload }));
jest.mock('./components/ChatInterface/ChatInterface', () => ({ __esModule: true, default: MockChatInterface }));

describe('App Component', () => {
  beforeEach(() => {
    // Clear mock calls between tests
    jest.clearAllMocks();
  });

  it('renders initial state correctly', async () => {
    await act(async () => {
      render(<App />);
    });

    // Check header content
    expect(screen.getByText('PDF Chatbot')).toBeInTheDocument();
    expect(screen.getByText('Upload your PDF file to start chatting')).toBeInTheDocument();

    // Check PDFUpload is rendered
    expect(screen.getByTestId('pdf-upload-container')).toBeInTheDocument();

    // ChatInterface should not be rendered initially
    expect(screen.queryByTestId('chat-interface-container')).not.toBeInTheDocument();
  });

  it('handles PDF upload success correctly', async () => {
    let component;
    await act(async () => {
      component = render(<App />);
    });

    // Verify initial state
    expect(screen.queryByTestId('chat-interface-container')).not.toBeInTheDocument();

    // Simulate successful PDF upload
    await act(async () => {
      fireEvent.click(screen.getByText('Upload PDF'));
    });

    // Verify ChatInterface appears with correct PDF ID
    await waitFor(() => {
      expect(screen.getByTestId('chat-interface-container')).toBeInTheDocument();
      expect(screen.getByText('Chat Interface - PDF ID: test-pdf-id')).toBeInTheDocument();
    });

    // Cleanup
    component.unmount();
  });

  it('passes correct props to child components', async () => {
    await act(async () => {
      render(<App />);
    });

    // Check PDFUpload props
    expect(PDFUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        onUploadSuccess: expect.any(Function)
      }),
      expect.any(Object)
    );

    // Trigger PDF upload
    await act(async () => {
      fireEvent.click(screen.getByText('Upload PDF'));
    });

    // Check ChatInterface props after upload
    await waitFor(() => {
      expect(ChatInterface).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfId: 'test-pdf-id'
        }),
        expect.any(Object)
      );
    });
  });

  it('maintains state after component updates', async () => {
    let component;
    await act(async () => {
      component = render(<App />);
    });

    // Trigger PDF upload
    await act(async () => {
      fireEvent.click(screen.getByText('Upload PDF'));
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('chat-interface-container')).toBeInTheDocument();
    });

    // Force a re-render by updating a state
    await act(async () => {
      fireEvent.click(screen.getByText('Upload PDF'));
    });

    // Verify ChatInterface still exists with correct PDF ID
    await waitFor(() => {
      expect(screen.getByTestId('chat-interface-container')).toBeInTheDocument();
      expect(screen.getByText('Chat Interface - PDF ID: test-pdf-id')).toBeInTheDocument();
    });

    // Verify no duplicate chat interfaces
    const chatInterfaces = screen.getAllByTestId('chat-interface-container');
    expect(chatInterfaces).toHaveLength(1);

    // Cleanup
    component.unmount();
  });
});
