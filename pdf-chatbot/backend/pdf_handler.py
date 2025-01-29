import os
import magic
from werkzeug.utils import secure_filename
from datetime import datetime
from models import PDFDocument, db
from PyPDF2 import PdfReader
from celery import Celery
from celery.result import AsyncResult

# Initialize Celery
celery = Celery('pdf_tasks', broker='redis://localhost:6379/0')

class PDFHandler:
    """Handles PDF file operations including validation, storage, and text extraction."""
    
    ALLOWED_MIME_TYPES = ['application/pdf']
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    def __init__(self, upload_folder):
        """Initialize PDFHandler with upload folder path.
        
        Args:
            upload_folder (str): Path to folder where PDFs will be stored
        """
        self.upload_folder = upload_folder
        os.makedirs(upload_folder, exist_ok=True)
    
    def validate_file(self, file):
        """Validate uploaded file.
        
        Args:
            file: FileStorage object from Flask request
            
        Returns:
            tuple: (is_valid, error_message)
        """
        # Check if file was selected
        if not file:
            return False, "No file provided"
            
        # Check file size
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        
        if size > self.MAX_FILE_SIZE:
            return False, f"File too large. Maximum size is {self.MAX_FILE_SIZE // (1024*1024)}MB"
            
        # Check file type using python-magic
        mime = magic.from_buffer(file.read(2048), mime=True)
        file.seek(0)
        
        if mime not in self.ALLOWED_MIME_TYPES:
            return False, "Invalid file type. Only PDF files are allowed"
            
        return True, None
    
    def save_file(self, file):
        """Save uploaded file and create database record.
        
        Args:
            file: FileStorage object from Flask request
            
        Returns:
            tuple: (PDFDocument, error_message)
        """
        try:
            # Secure the filename and generate storage path
            filename = secure_filename(file.filename)
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{timestamp}_{filename}"
            file_path = os.path.join(self.upload_folder, unique_filename)
            
            # Save the file
            file.save(file_path)
            
            # Create database record
            pdf_doc = PDFDocument(
                filename=filename,
                file_path=file_path,
                file_size=os.path.getsize(file_path),
                upload_date=datetime.utcnow()
            )
            
            db.session.add(pdf_doc)
            db.session.commit()
            
            return pdf_doc, None
            
        except Exception as e:
            # Clean up file if saved
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return None, f"Error saving file: {str(e)}"
            
    @celery.task(bind=True)
    def extract_text(self, pdf_id):
        """Extract text from PDF file asynchronously.
        
        Args:
            pdf_id: ID of the PDFDocument to process
            
        Returns:
            dict: Status and extracted text if successful
        """
        try:
            pdf_doc = PDFDocument.query.get(pdf_id)
            if not pdf_doc:
                return {"status": "error", "message": "PDF document not found"}
                
            # Update processing status
            pdf_doc.processing_status = "processing"
            db.session.commit()
            
            # Extract text using PyPDF2
            text_content = []
            with open(pdf_doc.file_path, 'rb') as file:
                try:
                    pdf_reader = PdfReader(file)
                    total_pages = len(pdf_reader.pages)
                    
                    for page_num in range(total_pages):
                        # Update progress
                        self.update_state(
                            state='PROGRESS',
                            meta={'current': page_num + 1, 'total': total_pages}
                        )
                        
                        try:
                            page = pdf_reader.pages[page_num]
                            text_content.append(page.extract_text())
                        except Exception as e:
                            text_content.append(f"[Error extracting page {page_num + 1}: {str(e)}]")
                            
                except Exception as e:
                    return {"status": "error", "message": f"Error reading PDF: {str(e)}"}
            
            # Join all text content
            full_text = "\n\n".join(text_content)
            
            # Update document with extracted text
            pdf_doc.extracted_text = full_text
            pdf_doc.processing_status = "completed"
            pdf_doc.processing_date = datetime.utcnow()
            db.session.commit()
            
            return {
                "status": "success",
                "text": full_text,
                "total_pages": total_pages
            }
            
        except Exception as e:
            if pdf_doc:
                pdf_doc.processing_status = "failed"
                pdf_doc.processing_error = str(e)
                db.session.commit()
            return {"status": "error", "message": str(e)}
    
    def get_processing_status(self, task_id):
        """Get the current status of a text extraction task.
        
        Args:
            task_id: Celery task ID
            
        Returns:
            dict: Task status and progress information
        """
        task = AsyncResult(task_id)
        if task.state == 'PENDING':
            response = {
                'state': task.state,
                'current': 0,
                'total': 1,
                'status': 'Pending...'
            }
        elif task.state != 'FAILURE':
            response = {
                'state': task.state,
                'current': task.info.get('current', 0),
                'total': task.info.get('total', 1),
                'status': task.info.get('status', '')
            }
            if 'result' in task.info:
                response['result'] = task.info['result']
        else:
            response = {
                'state': task.state,
                'current': 1,
                'total': 1,
                'status': str(task.info),
            }
        return response
