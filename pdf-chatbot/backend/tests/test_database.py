import os
import pytest
import uuid
from datetime import datetime
from flask import Flask
from sqlalchemy.exc import SQLAlchemyError

from config import TestingConfig
from models import db, PDFDocument, ChatMessage
from app import create_app

@pytest.fixture
def app():
    """Create and configure a test Flask application."""
    app = create_app(TestingConfig)
    return app

@pytest.fixture
def test_client(app):
    """Create a test client for the application."""
    return app.test_client()

@pytest.fixture
def init_database(app):
    """Initialize test database."""
    with app.app_context():
        db.create_all()
        yield db
        db.session.remove()
        db.drop_all()

def test_database_config_loading(app):
    """Test database configuration loading for different environments."""
    assert app.config['TESTING'] is True
    assert 'postgresql://' in app.config['SQLALCHEMY_DATABASE_URI']
    assert app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] is False

def test_pdf_document_crud(init_database, app):
    """Test CRUD operations for PDFDocument model."""
    with app.app_context():
        # Create
        pdf = PDFDocument(
            filename='test.pdf',
            file_path='/path/to/test.pdf',
            file_size=1024,
            title='Test PDF',
            author='Test Author',
            page_count=10
        )
        db.session.add(pdf)
        db.session.commit()
        
        # Read
        retrieved_pdf = PDFDocument.query.filter_by(filename='test.pdf').first()
        assert retrieved_pdf is not None
        assert retrieved_pdf.filename == 'test.pdf'
        assert retrieved_pdf.file_size == 1024
        
        # Update
        retrieved_pdf.title = 'Updated Title'
        db.session.commit()
        updated_pdf = PDFDocument.query.get(retrieved_pdf.id)
        assert updated_pdf.title == 'Updated Title'
        
        # Delete
        db.session.delete(updated_pdf)
        db.session.commit()
        deleted_pdf = PDFDocument.query.get(retrieved_pdf.id)
        assert deleted_pdf is None

def test_chat_message_relationships(init_database, app):
    """Test ChatMessage model relationships and threading."""
    with app.app_context():
        # Create a PDF document
        pdf = PDFDocument(
            filename='test.pdf',
            file_path='/path/to/test.pdf',
            file_size=1024
        )
        db.session.add(pdf)
        db.session.commit()
        
        # Create a conversation thread
        conversation_id = uuid.uuid4()
        
        # Create parent message
        parent_msg = ChatMessage(
            pdf_document_id=pdf.id,
            message_type='user',
            content='Parent message',
            conversation_id=conversation_id
        )
        db.session.add(parent_msg)
        db.session.commit()
        
        # Create reply message
        reply_msg = ChatMessage(
            pdf_document_id=pdf.id,
            message_type='assistant',
            content='Reply message',
            conversation_id=conversation_id,
            parent_message_id=parent_msg.id,
            response_time=1.5,
            tokens_used=100
        )
        db.session.add(reply_msg)
        db.session.commit()
        
        # Test relationships
        assert reply_msg.parent_message_id == parent_msg.id
        assert reply_msg in parent_msg.replies
        assert reply_msg.pdf_document == pdf
        assert len(pdf.chat_messages) == 2

def test_database_initialization(test_client):
    """Test database initialization and health check endpoint."""
    response = test_client.get('/api/health')
    assert response.status_code == 200
    
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert data['database'] == 'connected'

def test_error_handling(init_database, app):
    """Test error handling for database operations."""
    with app.app_context():
        # Test invalid PDF document creation
        invalid_pdf = PDFDocument()  # Missing required fields
        with pytest.raises(SQLAlchemyError):
            db.session.add(invalid_pdf)
            db.session.commit()
        db.session.rollback()
        
        # Test invalid chat message creation
        invalid_msg = ChatMessage(
            message_type='invalid_type',  # Invalid message type
            content='Test message',
            conversation_id=uuid.uuid4()
        )
        with pytest.raises(SQLAlchemyError):
            db.session.add(invalid_msg)
            db.session.commit()
        db.session.rollback()