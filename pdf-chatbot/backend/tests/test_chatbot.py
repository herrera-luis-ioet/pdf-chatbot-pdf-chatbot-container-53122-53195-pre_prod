"""Unit tests for the ChatbotService class."""
import pytest
import torch
from unittest.mock import Mock, patch
from chatbot import ChatbotService
from models import PDFDocument, ChatMessage

@pytest.fixture
def chatbot_service():
    """Create a ChatbotService instance for testing."""
    return ChatbotService()

@pytest.fixture
def mock_pdf_document(db):
    """Create a mock PDF document for testing."""
    pdf = PDFDocument(
        filename='test.pdf',
        file_path='/tmp/test.pdf',
        file_size=1000,
        content='This is a test document.\n\nIt contains multiple paragraphs.\n\n'
                'The chatbot should be able to find relevant information.'
    )
    db.session.add(pdf)
    db.session.commit()
    return pdf

def test_encode_text(chatbot_service):
    """Test text encoding functionality."""
    text = "Test message"
    encoding = chatbot_service._encode_text(text)
    
    assert isinstance(encoding, torch.Tensor)
    assert encoding.dim() == 1  # Should be a 1D tensor
    assert encoding.size(0) == 384  # Expected embedding size for all-MiniLM-L6-v2

def test_compute_similarity(chatbot_service):
    """Test similarity computation between two text embeddings."""
    text1 = "This is a test message"
    text2 = "This is also a test message"
    
    embedding1 = chatbot_service._encode_text(text1)
    embedding2 = chatbot_service._encode_text(text2)
    
    similarity = chatbot_service._compute_similarity(embedding1, embedding2)
    
    assert isinstance(similarity, float)
    assert 0 <= similarity <= 1  # Similarity should be between 0 and 1

def test_process_message_with_relevant_content(chatbot_service, mock_pdf_document, db):
    """Test processing a message that has relevant content in the PDF."""
    user_id = 1
    message = "What does the test document contain?"
    
    response, confidence = chatbot_service.process_message(
        user_id=user_id,
        pdf_id=str(mock_pdf_document.id),
        message=message
    )
    
    # Verify response
    assert isinstance(response, str)
    assert isinstance(confidence, float)
    assert confidence > 0.5  # Should have high confidence for relevant content
    assert "test document" in response.lower()
    
    # Verify chat messages were stored
    messages = ChatMessage.query.filter_by(
        user_id=user_id,
        pdf_id=str(mock_pdf_document.id)
    ).all()
    assert len(messages) == 2  # Should have user message and bot response
    assert messages[0].is_user is True
    assert messages[0].message == message
    assert messages[1].is_user is False
    assert messages[1].message == response

def test_process_message_with_irrelevant_content(chatbot_service, mock_pdf_document, db):
    """Test processing a message that has no relevant content in the PDF."""
    user_id = 1
    message = "What is the weather like today?"
    
    response, confidence = chatbot_service.process_message(
        user_id=user_id,
        pdf_id=str(mock_pdf_document.id),
        message=message
    )
    
    # Verify response
    assert isinstance(response, str)
    assert isinstance(confidence, float)
    assert confidence <= 0.5  # Should have low confidence for irrelevant content
    assert "rephrase" in response.lower()  # Should ask user to rephrase
    
    # Verify chat messages were stored
    messages = ChatMessage.query.filter_by(
        user_id=user_id,
        pdf_id=str(mock_pdf_document.id)
    ).all()
    assert len(messages) == 2  # Should have user message and bot response

def test_process_message_invalid_pdf(chatbot_service, db):
    """Test processing a message for a non-existent PDF."""
    user_id = 1
    message = "Test message"
    
    response, confidence = chatbot_service.process_message(
        user_id=user_id,
        pdf_id="invalid-id",
        message=message
    )
    
    assert "couldn't find the pdf document" in response.lower()
    assert confidence == 0.0

def test_get_chat_history(chatbot_service, mock_pdf_document, db):
    """Test retrieving chat history for a user and PDF."""
    user_id = 1
    pdf_id = str(mock_pdf_document.id)
    
    # Add some test messages
    messages = [
        ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message="User message 1",
            is_user=True
        ),
        ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message="Bot response 1",
            is_user=False
        ),
        ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message="User message 2",
            is_user=True
        )
    ]
    for msg in messages:
        db.session.add(msg)
    db.session.commit()
    
    # Get history
    history = chatbot_service.get_chat_history(user_id, pdf_id)
    
    assert len(history) == 3
    assert all(isinstance(msg, dict) for msg in history)
    assert all(set(msg.keys()) == {'id', 'message', 'is_user', 'timestamp'} 
              for msg in history)
    assert [msg['message'] for msg in history] == [
        "User message 1",
        "Bot response 1",
        "User message 2"
    ]