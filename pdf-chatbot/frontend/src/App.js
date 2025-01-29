import './App.css';
import { useState } from 'react';
import PDFUpload from './components/PDFUpload/PDFUpload';
import ChatInterface from './components/ChatInterface/ChatInterface';

function App() {
  const [currentPdfId, setCurrentPdfId] = useState(null);

  const handlePdfUploadSuccess = (pdfId) => {
    setCurrentPdfId(pdfId);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>PDF Chatbot</h1>
        <p>Upload your PDF file to start chatting</p>
      </header>
      <main>
        <PDFUpload onUploadSuccess={handlePdfUploadSuccess} />
        {currentPdfId && <ChatInterface pdfId={currentPdfId} />}
      </main>
    </div>
  );
}

export default App;
