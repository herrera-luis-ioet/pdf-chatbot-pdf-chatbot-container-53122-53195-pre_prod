"""Integration tests for the chat API endpoints."""
import json
import pytest
from models import PDFDocument, ChatMessage

@pytest.fixture
def test_pdf(db):
    """Create a test PDF document."""
    pdf = PDFDocument(
        filename='test.pdf',
        file_path='/tmp/test.pdf',
        file_size=1000,
        content='This is a test document with some content for testing the chatbot API.'
    )
    db.session.add(pdf)
    db.session.commit()
    return pdf

def test_chat_message_endpoint_success(client, test_pdf):
    """Test successful chat message processing."""
    # Send chat message
    response = client.post(
        f'/api/chat/{test_pdf.id}',
        json={'message': 'What is in the test document?'}
    )
    
    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert isinstance(data['response'], str)
    assert isinstance(data['confidence'], float)
    assert len(data['response']) > 0
    assert data['confidence'] > 0  # Should have some confidence for relevant query

def test_chat_message_endpoint_no_message(client, test_pdf):
    """Test chat endpoint with missing message."""
    # Send request without message
    response = client.post(f'/api/chat/{test_pdf.id}', json={})
    
    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['status'] == 'error'
    assert 'message' in data
    assert 'No message provided' in data['message']

def test_chat_message_endpoint_invalid_pdf(client):
    """Test chat endpoint with invalid PDF ID."""
    # Send chat message for non-existent PDF
    response = client.post(
        '/api/chat/invalid-id',
        json={'message': 'Test message'}
    )
    
    # Check response
    assert response.status_code == 200  # API still returns 200 with error message
    data = json.loads(response.data)
    assert data['status'] == 'success'  # API maintains success status
    assert "couldn't find the pdf document" in data['response'].lower()
    assert data['confidence'] == 0.0

def test_chat_message_endpoint_invalid_json(client, test_pdf):
    """Test chat endpoint with invalid JSON data."""
    # Send invalid JSON
    response = client.post(
        f'/api/chat/{test_pdf.id}',
        data='invalid json',
        content_type='application/json'
    )
    
    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['status'] == 'error'

def test_chat_history_endpoint_success(client, test_pdf, db):
    """Test successful retrieval of chat history."""
    # Add some test messages
    messages = [
        ChatMessage(
            user_id=1,
            pdf_id=str(test_pdf.id),
            message="Test message 1",
            is_user=True
        ),
        ChatMessage(
            user_id=1,
            pdf_id=str(test_pdf.id),
            message="Test response 1",
            is_user=False
        )
    ]
    for msg in messages:
        db.session.add(msg)
    db.session.commit()
    
    # Get chat history
    response = client.get(f'/api/chat/{test_pdf.id}/history')
    
    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert 'history' in data
    assert len(data['history']) == 2
    assert all(isinstance(msg, dict) for msg in data['history'])
    assert all(set(msg.keys()) == {'id', 'message', 'is_user', 'timestamp'} 
              for msg in data['history'])

def test_chat_history_endpoint_no_history(client, test_pdf):
    """Test chat history endpoint when no messages exist."""
    # Get chat history for PDF with no messages
    response = client.get(f'/api/chat/{test_pdf.id}/history')
    
    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert 'history' in data
    assert len(data['history']) == 0

def test_chat_history_endpoint_invalid_pdf(client):
    """Test chat history endpoint with invalid PDF ID."""
    # Get chat history for non-existent PDF
    response = client.get('/api/chat/invalid-id/history')
    
    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert 'history' in data
    assert len(data['history']) == 0

def test_chat_message_sequence(client, test_pdf):
    """Test a sequence of chat messages to verify conversation flow."""
    # Send first message
    response1 = client.post(
        f'/api/chat/{test_pdf.id}',
        json={'message': 'What is in the document?'}
    )
    assert response1.status_code == 200
    data1 = json.loads(response1.data)
    assert data1['status'] == 'success'
    
    # Send follow-up message
    response2 = client.post(
        f'/api/chat/{test_pdf.id}',
        json={'message': 'Can you provide more details?'}
    )
    assert response2.status_code == 200
    data2 = json.loads(response2.data)
    assert data2['status'] == 'success'
    
    # Check chat history
    history_response = client.get(f'/api/chat/{test_pdf.id}/history')
    assert history_response.status_code == 200
    history_data = json.loads(history_response.data)
    assert len(history_data['history']) == 4  # 2 user messages + 2 bot responses