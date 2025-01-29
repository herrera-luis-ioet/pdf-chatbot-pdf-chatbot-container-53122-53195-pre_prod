from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID
import uuid

db = SQLAlchemy()

# PUBLIC_INTERFACE
class PDFDocument(db.Model):
    """Model for storing PDF document metadata and storage information."""
    __tablename__ = 'pdf_documents'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)  # Size in bytes
    upload_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_accessed = db.Column(db.DateTime, nullable=True)
    
    # Metadata
    title = db.Column(db.String(255), nullable=True)
    author = db.Column(db.String(255), nullable=True)
    page_count = db.Column(db.Integer, nullable=True)
    
    # Text extraction and processing
    extracted_text = db.Column(db.Text, nullable=True)
    processing_status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    processing_date = db.Column(db.DateTime, nullable=True)
    processing_error = db.Column(db.Text, nullable=True)
    processing_progress = db.Column(db.Float, default=0.0)  # Progress percentage
    
    # Relationships
    chat_messages = db.relationship('ChatMessage', back_populates='pdf_document', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<PDFDocument {self.filename}>'

# PUBLIC_INTERFACE
class ChatMessage(db.Model):
    """Model for storing chat messages and their relationships with PDF documents."""
    __tablename__ = 'chat_messages'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pdf_document_id = db.Column(UUID(as_uuid=True), db.ForeignKey('pdf_documents.id'), nullable=False)
    message_type = db.Column(db.String(10), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # For tracking context and conversation flow
    conversation_id = db.Column(UUID(as_uuid=True), nullable=False)
    parent_message_id = db.Column(UUID(as_uuid=True), db.ForeignKey('chat_messages.id'), nullable=True)
    
    # Metadata for assistant responses
    response_time = db.Column(db.Float, nullable=True)  # Response time in seconds
    tokens_used = db.Column(db.Integer, nullable=True)  # Number of tokens used in response
    
    # Relationships
    pdf_document = db.relationship('PDFDocument', back_populates='chat_messages')
    replies = db.relationship(
        'ChatMessage',
        backref=db.backref('parent', remote_side=[id]),
        cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f'<ChatMessage {self.id}: {self.message_type}>'
