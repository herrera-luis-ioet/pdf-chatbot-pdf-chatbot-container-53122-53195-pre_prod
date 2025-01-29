"""
Chatbot service with NLP integration for handling PDF-related queries.
"""
from typing import Dict, List, Tuple, Optional
from sentence_transformers import SentenceTransformer
import torch
from models import db, PDFDocument, ChatMessage

class ChatbotService:
    """Service for handling chatbot interactions with NLP capabilities."""
    
    def __init__(self):
        """Initialize the chatbot service with NLP model."""
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
    def _encode_text(self, text: str) -> torch.Tensor:
        """Encode text using the sentence transformer model.
        
        Args:
            text: Input text to encode.
            
        Returns:
            Encoded text tensor.
        """
        return self.model.encode(text, convert_to_tensor=True)
    
    def _compute_similarity(self, query_embedding: torch.Tensor, 
                          context_embedding: torch.Tensor) -> float:
        """Compute cosine similarity between query and context embeddings.
        
        Args:
            query_embedding: Encoded query tensor.
            context_embedding: Encoded context tensor.
            
        Returns:
            Similarity score between 0 and 1.
        """
        return torch.nn.functional.cosine_similarity(
            query_embedding.unsqueeze(0),
            context_embedding.unsqueeze(0)
        ).item()
    
    def process_message(self, user_id: int, pdf_id: str, 
                       message: str) -> Tuple[str, float]:
        """Process a user message and generate a response.
        
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
            
        # Encode user query
        query_embedding = self._encode_text(message)
        
        # Split PDF content into chunks and find most relevant section
        chunks = [chunk.strip() for chunk in pdf_doc.content.split('\n\n') if chunk.strip()]
        best_chunk = None
        best_score = 0.0
        
        for chunk in chunks:
            chunk_embedding = self._encode_text(chunk)
            similarity = self._compute_similarity(query_embedding, chunk_embedding)
            
            if similarity > best_score:
                best_score = similarity
                best_chunk = chunk
        
        # Store the message in chat history
        chat_message = ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message=message,
            is_user=True
        )
        db.session.add(chat_message)
        
        # Generate and store response
        response = (
            f"Based on the PDF content, here's what I found:\n\n{best_chunk}"
            if best_score > 0.5
            else "I couldn't find a relevant answer in the PDF. Could you please rephrase your question?"
        )
        
        chat_message = ChatMessage(
            user_id=user_id,
            pdf_id=pdf_id,
            message=response,
            is_user=False
        )
        db.session.add(chat_message)
        db.session.commit()
        
        return response, best_score
    
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