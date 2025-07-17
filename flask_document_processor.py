from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import cv2
import numpy as np
from PIL import Image
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def order_points(pts):
    """Order points in the order: top-left, top-right, bottom-right, bottom-left"""
    rect = np.zeros((4, 2), dtype="float32")
    
    # Sum and difference to find corners
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    
    # Top-left point has smallest sum
    rect[0] = pts[np.argmin(s)]
    # Bottom-right point has largest sum
    rect[2] = pts[np.argmax(s)]
    # Top-right point has smallest difference
    rect[1] = pts[np.argmin(diff)]
    # Bottom-left point has largest difference
    rect[3] = pts[np.argmax(diff)]
    
    return rect

def four_point_transform(image, pts):
    """Apply perspective transform to get bird's eye view of document"""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    # Compute width of new image
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    # Compute height of new image
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # Destination points for perspective transform
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # Compute perspective transform matrix and apply it
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped

def detect_document_edges(image):
    """Detect document edges using contour detection"""
    original = image.copy()
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Apply adaptive threshold
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    
    # Apply morphological operations to clean up the image
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    # Find edges using Canny
    edges = cv2.Canny(thresh, 50, 150, apertureSize=3)
    
    # Dilate edges to make them more prominent
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Sort contours by area (largest first)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    # Find the largest contour that has 4 points (document)
    document_contour = None
    for contour in contours:
        # Approximate contour
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # If contour has 4 points and is large enough, it's likely our document
        if len(approx) == 4 and cv2.contourArea(contour) > 10000:
            document_contour = approx
            break
    
    if document_contour is not None:
        # Apply perspective transform
        warped = four_point_transform(original, document_contour.reshape(4, 2))
        return warped, document_contour.reshape(4, 2)
    else:
        # If no document found, try alternative method
        return detect_document_edges_alternative(original)

def detect_document_edges_alternative(image):
    """Alternative method using edge detection and hough lines"""
    original = image.copy()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply bilateral filter to reduce noise while keeping edges sharp
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # Apply edge detection
    edges = cv2.Canny(filtered, 50, 150, apertureSize=3)
    
    # Find lines using Hough transform
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
    
    if lines is not None and len(lines) >= 4:
        # This is a simplified approach - in practice, you'd want to
        # find intersections of lines to get corner points
        # For now, we'll use the whole image with some padding removed
        h, w = image.shape[:2]
        padding = min(h, w) // 20  # 5% padding
        
        # Create corner points with padding
        corners = np.array([
            [padding, padding],
            [w - padding, padding],
            [w - padding, h - padding],
            [padding, h - padding]
        ], dtype="float32")
        
        warped = four_point_transform(original, corners)
        return warped, corners
    
    # If all else fails, return original with minimal cropping
    h, w = image.shape[:2]
    padding = min(h, w) // 40  # 2.5% padding
    cropped = image[padding:h-padding, padding:w-padding]
    
    corners = np.array([
        [padding, padding],
        [w - padding, padding],
        [w - padding, h - padding],
        [padding, h - padding]
    ], dtype="float32")
    
    return cropped, corners

def enhance_document(image):
    """Enhance the cropped document image"""
    # Convert to grayscale for processing
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive histogram equalization
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Apply bilateral filter to reduce noise
    filtered = cv2.bilateralFilter(enhanced, 9, 75, 75)
    
    # Convert back to BGR for consistency
    result = cv2.cvtColor(filtered, cv2.COLOR_GRAY2BGR)
    
    return result

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Document processing service is running'})

@app.route('/process-document', methods=['POST'])
def process_document():
    """Process document image to detect borders and auto-crop"""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        image_data = data['image']
        
        # Remove data URL prefix if present
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to OpenCV format (RGB to BGR)
        opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        # Detect document edges and crop
        cropped_image, corners = detect_document_edges(opencv_image)
        
        # Enhance the cropped document
        enhanced_image = enhance_document(cropped_image)
        
        # Convert back to PIL Image
        enhanced_pil = Image.fromarray(cv2.cvtColor(enhanced_image, cv2.COLOR_BGR2RGB))
        
        # Convert to base64 for response
        buffer = io.BytesIO()
        enhanced_pil.save(buffer, format='JPEG', quality=95)
        processed_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Also create original with detected corners for visualization
        original_with_corners = opencv_image.copy()
        if corners is not None:
            # Draw detected corners
            for point in corners.astype(int):
                cv2.circle(original_with_corners, tuple(point), 10, (0, 255, 0), -1)
            # Draw lines connecting corners
            cv2.polylines(original_with_corners, [corners.astype(int)], True, (0, 255, 0), 3)
        
        original_pil = Image.fromarray(cv2.cvtColor(original_with_corners, cv2.COLOR_BGR2RGB))
        original_buffer = io.BytesIO()
        original_pil.save(original_buffer, format='JPEG', quality=95)
        original_base64 = base64.b64encode(original_buffer.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'processed_image': processed_base64,
            'original_with_detection': original_base64,
            'corners_detected': corners.tolist() if corners is not None else None,
            'message': 'Document processed and cropped successfully'
        })
        
    except Exception as e:
        print(f"Error processing document: {str(e)}")
        return jsonify({'error': f'Failed to process document: {str(e)}'}), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    """Test endpoint"""
    return jsonify({'message': 'Flask Document Processing server is running!'})

if __name__ == '__main__':
    print("Starting Flask Document Processing Server...")
    print("Make sure you have installed the required dependencies:")
    print("pip install flask flask-cors opencv-python pillow numpy")
    print("\nServer will start on http://localhost:5000")
    print("Update the FLASK_API_URL in your React Native app to match your IP address.")
    
    app.run(host='0.0.0.0', port=5000, debug=True)