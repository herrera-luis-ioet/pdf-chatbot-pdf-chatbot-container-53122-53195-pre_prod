import os
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import RequestEntityTooLarge
from config import get_config
from models import db, ChatMessage
from pdf_handler import PDFHandler
from chatbot import ChatbotService

# Initialize SocketIO at module level for proper registration
socketio = SocketIO(cors_allowed_origins="*")

def create_app(config_class=None):
    """Create and configure the Flask application.
    
    Args:
        config_class: Configuration class to use. If None, determined from environment.
    
    Returns:
        Configured Flask application instance with SocketIO integration.
    """
    app = Flask(__name__)
    
    # Load configuration
    if config_class is None:
        config_class = get_config()
    app.config.from_object(config_class)
    
    # Initialize extensions
    CORS(app)
    db.init_app(app)
    socketio.init_app(app)
    
    # Create database tables
    with app.app_context():
        try:
            db.create_all()
        except SQLAlchemyError as e:
            app.logger.error(f"Failed to create database tables: {str(e)}")
            raise
    
    @app.route('/api/health')
    def health_check():
        """Health check endpoint that includes database connection status."""
        try:
            # Verify database connection
            db.session.execute('SELECT 1')
            db_status = 'connected'
        except SQLAlchemyError as e:
            app.logger.error(f"Database health check failed: {str(e)}")
            db_status = 'disconnected'
        
        return jsonify({
            'status': 'healthy',
            'database': db_status
        })
    
    # Configure upload folder
    upload_folder = os.path.join(app.instance_path, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    pdf_handler = PDFHandler(upload_folder)
    
    @app.route('/api/upload', methods=['POST'])
    def upload_pdf():
        """Handle PDF file upload.
        
        Returns:
            JSON response with upload status and file details or error message.
        """
        try:
            # Validate request
            if 'file' not in request.files:
                app.logger.warning("Upload attempt without file")
                return jsonify({
                    'status': 'error',
                    'message': 'No file part in the request'
                }), 400
                
            file = request.files['file']
            if file.filename == '':
                app.logger.warning("Upload attempt with empty filename")
                return jsonify({
                    'status': 'error',
                    'message': 'No file selected'
                }), 400
            
            # Validate file
            is_valid, error = pdf_handler.validate_file(file)
            if not is_valid:
                app.logger.warning(f"Invalid file upload attempt: {error}")
                return jsonify({
                    'status': 'error',
                    'message': error
                }), 400
            
            # Save file and create database record
            pdf_doc, error = pdf_handler.save_file(file)
            if error:
                app.logger.error(f"Failed to save uploaded file: {error}")
                return jsonify({
                    'status': 'error',
                    'message': error
                }), 500
            
            return jsonify({
                'status': 'success',
                'message': 'File uploaded successfully',
                'file': {
                    'id': str(pdf_doc.id),
                    'filename': pdf_doc.filename,
                    'size': pdf_doc.file_size,
                    'upload_date': pdf_doc.upload_date.isoformat()
                }
            }), 201
            
        except RequestEntityTooLarge:
            return jsonify({
                'status': 'error',
                'message': 'File too large'
            }), 413
        except Exception as e:
            app.logger.error(f"Error handling file upload: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500
    
    # Initialize chatbot service
    chatbot_service = ChatbotService()
    
    @app.route('/api/chat/<pdf_id>', methods=['POST'])
    def chat_message(pdf_id):
        """Handle chat messages for a specific PDF.
        
        Args:
            pdf_id: ID of the PDF document being discussed.
            
        Returns:
            JSON response with chatbot's reply and confidence score.
        """
        try:
            data = request.get_json()
            if not data or 'message' not in data:
                return jsonify({
                    'status': 'error',
                    'message': 'No message provided'
                }), 400
            
            # TODO: Replace with actual user ID from authentication
            user_id = 1
            
            response, confidence = chatbot_service.process_message(
                user_id=user_id,
                pdf_id=pdf_id,
                message=data['message']
            )
            
            return jsonify({
                'status': 'success',
                'response': response,
                'confidence': confidence
            })
            
        except Exception as e:
            app.logger.error(f"Error processing chat message: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500
    
    @app.route('/api/chat/<pdf_id>/history', methods=['GET'])
    def chat_history(pdf_id):
        """Retrieve chat history for a specific PDF.
        
        Args:
            pdf_id: ID of the PDF document.
            
        Returns:
            JSON response with chat history.
        """
        try:
            # TODO: Replace with actual user ID from authentication
            user_id = 1
            
            history = chatbot_service.get_chat_history(user_id, pdf_id)
            return jsonify({
                'status': 'success',
                'history': history
            })
            
        except Exception as e:
            app.logger.error(f"Error retrieving chat history: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500

    return app

# Create the application instance with default configuration
app = create_app()

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    app.logger.info('Client connected')
    emit('connection_status', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    app.logger.info('Client disconnected')

@socketio.on('chat_message')
def handle_chat_message(data):
    """Handle incoming chat messages via WebSocket.
    
    Args:
        data: Dictionary containing message data (pdf_id, message)
    """
    try:
        pdf_id = data.get('pdf_id')
        message = data.get('message')
        user_id = 1  # TODO: Replace with actual user ID from authentication

        if not pdf_id or not message:
            emit('error', {'message': 'Invalid message data'})
            return

        chatbot_service = ChatbotService()
        response, confidence = chatbot_service.process_message(
            user_id=user_id,
            pdf_id=pdf_id,
            message=message
        )

        # Emit the response to all clients viewing the same PDF
        emit('chat_response', {
            'pdf_id': pdf_id,
            'message': message,
            'response': response,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat()
        }, room=str(pdf_id))

    except Exception as e:
        app.logger.error(f"Error processing WebSocket message: {str(e)}")
        emit('error', {'message': 'Internal server error'})

@socketio.on('join')
def handle_join(data):
    """Handle client joining a PDF-specific room.
    
    Args:
        data: Dictionary containing pdf_id
    """
    pdf_id = data.get('pdf_id')
    if pdf_id:
        join_room(str(pdf_id))
        emit('room_joined', {'pdf_id': pdf_id})

if __name__ == '__main__':
    socketio.run(app, debug=True)
