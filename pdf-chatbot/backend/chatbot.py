"""
Mock chatbot service for testing purposes.
"""
from typing import Dict, List, Tuple
from models import db, PDFDocument, ChatMessage

class ChatbotService:
    """Mock service for handling chatbot interactions."""
    
    def __init__(self):
        """Initialize the mock chatbot service."""
        pass
        
    def process_message(self, user_id: int, pdf_id: str, 
                       message: str) -> Tuple[str, float]:
        """Process a user message and generate a mock response.
        
        Args:
            user_id: ID of the user sending the message.
            pdf_id: ID of the PDF document being discussed.
            message: User's message text.
            
        Returns:
            Tuple containing (response text, confidence score).
        """
        # Get PDF content
        pdf_doc = PDFDocument.query.get(pdf_id)
        if not pdf_doc or not pdf_doc.content:
            return "I'm sorry, I couldn't find the PDF document you're referring to.", 0.0
            
        # Store the message in chat history
        chat_message = ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message=message,
            is_user=True
        )
        db.session.add(chat_message)
        
        # Generate mock response
        response = "This is a mock response for testing purposes."
        confidence = 0.8
        
        chat_message = ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message=response,
            is_user=False
        )
        db.session.add(chat_message)
        db.session.commit()
        
        return response, confidence
    
    def get_chat_history(self, user_id: int, pdf_id: str) -> List[Dict]:
        """Retrieve chat history for a specific user and PDF.
        
        Args:
            user_id: ID of the user.
            pdf_id: ID of the PDF document.
            
        Returns:
            List of chat messages with their metadata.
        """
        messages = ChatMessage.query.filter_by(
            user_id=user_id,
            pdf_id=pdf_id
        ).order_by(ChatMessage.timestamp.asc()).all()
        
        return [{
            'id': msg.id,
            'message': msg.message,
            'is_user': msg.is_user,
            'timestamp': msg.timestamp.isoformat()
        } for msg in messages]