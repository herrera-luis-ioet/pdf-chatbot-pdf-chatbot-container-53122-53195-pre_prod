import os
import pytest
from werkzeug.datastructures import FileStorage
from io import BytesIO
from datetime import datetime
from pdf_handler import PDFHandler
from models import PDFDocument

@pytest.fixture
def pdf_handler(tmp_path):
    """Create a PDFHandler instance with a temporary upload folder."""
    upload_folder = tmp_path / "uploads"
    return PDFHandler(str(upload_folder))

@pytest.fixture
def mock_pdf_file():
    """Create a mock PDF file for testing."""
    # Create a mock PDF file with PDF magic bytes
    content = b"%PDF-1.4\n%¥±ë\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj"
    return FileStorage(
        stream=BytesIO(content),
        filename="test.pdf",
        content_type="application/pdf",
    )

@pytest.fixture
def mock_large_file():
    """Create a mock file that exceeds size limit."""
    content = b"x" * (PDFHandler.MAX_FILE_SIZE + 1)
    return FileStorage(
        stream=BytesIO(content),
        filename="large.pdf",
        content_type="application/pdf",
    )

@pytest.fixture
def mock_invalid_file():
    """Create a mock non-PDF file."""
    content = b"This is not a PDF file"
    return FileStorage(
        stream=BytesIO(content),
        filename="test.txt",
        content_type="text/plain",
    )

def test_validate_file_no_file(pdf_handler):
    """Test validation when no file is provided."""
    is_valid, error = pdf_handler.validate_file(None)
    assert not is_valid
    assert error == "No file provided"

def test_validate_file_size_limit(pdf_handler, mock_large_file):
    """Test file size validation."""
    is_valid, error = pdf_handler.validate_file(mock_large_file)
    assert not is_valid
    assert "File too large" in error

def test_validate_file_type(pdf_handler, mock_invalid_file):
    """Test file type validation."""
    is_valid, error = pdf_handler.validate_file(mock_invalid_file)
    assert not is_valid
    assert "Invalid file type" in error

def test_validate_valid_pdf(pdf_handler, mock_pdf_file):
    """Test validation of a valid PDF file."""
    is_valid, error = pdf_handler.validate_file(mock_pdf_file)
    assert is_valid
    assert error is None

def test_save_file_success(pdf_handler, mock_pdf_file, mocker):
    """Test successful file save operation."""
    # Mock database session
    mock_db = mocker.patch('pdf_handler.db')
    
    # Test file save
    pdf_doc, error = pdf_handler.save_file(mock_pdf_file)
    
    assert error is None
    assert isinstance(pdf_doc, PDFDocument)
    assert pdf_doc.filename == "test.pdf"
    assert os.path.exists(pdf_doc.file_path)
    assert mock_db.session.add.called
    assert mock_db.session.commit.called

def test_save_file_error(pdf_handler, mock_pdf_file, mocker):
    """Test file save operation with database error."""
    # Mock database session to raise an error
    mock_db = mocker.patch('pdf_handler.db')
    mock_db.session.commit.side_effect = Exception("Database error")
    
    # Test file save
    pdf_doc, error = pdf_handler.save_file(mock_pdf_file)
    
    assert pdf_doc is None
    assert "Error saving file" in error
    # Verify file was cleaned up
    assert not os.path.exists(os.path.join(pdf_handler.upload_folder, mock_pdf_file.filename))

def test_upload_folder_creation(tmp_path):
    """Test that upload folder is created if it doesn't exist."""
    upload_folder = tmp_path / "new_uploads"
    PDFHandler(str(upload_folder))
    assert os.path.exists(upload_folder)

def test_unique_filename_generation(pdf_handler, mock_pdf_file, mocker):
    """Test that unique filenames are generated for uploads."""
    # Mock datetime to ensure consistent filename
    fixed_time = datetime(2024, 1, 1, 12, 0, 0)
    mocker.patch('pdf_handler.datetime', autospec=True)
    mocker.patch('pdf_handler.datetime.utcnow', return_value=fixed_time)
    
    # Mock database session
    mock_db = mocker.patch('pdf_handler.db')
    
    pdf_doc, _ = pdf_handler.save_file(mock_pdf_file)
    
    expected_filename = f"20240101_120000_test.pdf"
    assert os.path.basename(pdf_doc.file_path) == expected_filename