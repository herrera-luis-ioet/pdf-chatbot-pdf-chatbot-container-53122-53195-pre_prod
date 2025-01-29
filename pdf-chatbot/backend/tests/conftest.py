import os
import pytest
from app import create_app
from models import db as _db, PDFDocument, ChatMessage
from datetime import datetime, timedelta

@pytest.fixture
def app():
    """Create application for the tests."""
    _app = create_app('testing')
    # Ensure test upload folder exists
    os.makedirs(_app.config['UPLOAD_FOLDER'], exist_ok=True)
    return _app

@pytest.fixture
def db(app):
    """Create database for the tests."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.close()
        _db.drop_all()

@pytest.fixture
def client(app):
    """Create client for the tests."""
    return app.test_client()

@pytest.fixture
def mock_pdf_content():
    """Create mock PDF content for testing."""
    return b"%PDF-1.4\n%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj"

@pytest.fixture
def sample_pdf(db):
    """Create a sample PDF document for testing."""
    pdf = PDFDocument(
        filename='sample.pdf',
        file_path='/tmp/sample.pdf',
        file_size=1024,
        content='Sample PDF content for testing.\nThis document contains test data.',
        upload_date=datetime.utcnow()
    )
    db.session.add(pdf)
    db.session.commit()
    return pdf

@pytest.fixture
def sample_chat_history(db, sample_pdf):
    """Create sample chat history for testing."""
    base_time = datetime.utcnow()
    messages = [
        ChatMessage(
            user_id=1,
            pdf_id=str(sample_pdf.id),
            message="What is this document about?",
            is_user=True,
            timestamp=base_time
        ),
        ChatMessage(
            user_id=1,
            pdf_id=str(sample_pdf.id),
            message="This document contains test data for our application.",
            is_user=False,
            timestamp=base_time + timedelta(seconds=1)
        )
    ]
    for msg in messages:
        db.session.add(msg)
    db.session.commit()
    return messages
