import os
import pytest
from io import BytesIO
from models import PDFDocument

def test_upload_endpoint_success(client, tmp_path):
    """Test successful file upload through the API endpoint."""
    # Create a mock PDF file
    content = b"%PDF-1.4\n%¥±ë\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj"
    data = {
        'file': (BytesIO(content), 'test.pdf', 'application/pdf')
    }
    
    response = client.post('/api/upload', data=data, content_type='multipart/form-data')
    
    assert response.status_code == 200
    assert b'success' in response.data.lower()
    
    # Verify database record was created
    pdf_doc = PDFDocument.query.filter_by(filename='test.pdf').first()
    assert pdf_doc is not None
    assert os.path.exists(pdf_doc.file_path)

def test_upload_endpoint_no_file(client):
    """Test upload endpoint with no file."""
    response = client.post('/api/upload', data={}, content_type='multipart/form-data')
    
    assert response.status_code == 400
    assert b'no file' in response.data.lower()

def test_upload_endpoint_invalid_file(client):
    """Test upload endpoint with invalid file type."""
    data = {
        'file': (BytesIO(b'not a pdf'), 'test.txt', 'text/plain')
    }
    
    response = client.post('/api/upload', data=data, content_type='multipart/form-data')
    
    assert response.status_code == 400
    assert b'invalid file type' in response.data.lower()

def test_upload_endpoint_large_file(client):
    """Test upload endpoint with file exceeding size limit."""
    content = b"x" * (50 * 1024 * 1024 + 1)  # Slightly over 50MB
    data = {
        'file': (BytesIO(content), 'large.pdf', 'application/pdf')
    }
    
    response = client.post('/api/upload', data=data, content_type='multipart/form-data')
    
    assert response.status_code == 400
    assert b'file too large' in response.data.lower()

def test_upload_endpoint_server_error(client, mocker):
    """Test upload endpoint when server encounters an error."""
    # Mock PDFHandler to raise an exception
    mocker.patch('app.PDFHandler.save_file', side_effect=Exception("Server error"))
    
    content = b"%PDF-1.4\n%¥±ë"
    data = {
        'file': (BytesIO(content), 'test.pdf', 'application/pdf')
    }
    
    response = client.post('/api/upload', data=data, content_type='multipart/form-data')
    
    assert response.status_code == 500
    assert b'error' in response.data.lower()