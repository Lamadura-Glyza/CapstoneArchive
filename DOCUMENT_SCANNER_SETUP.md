# Document Scanner Setup Guide

This guide will help you set up the Document Scanner feature for your React Native app with a Flask backend that uses OpenCV for border detection and auto-cropping.

## Prerequisites

- React Native/Expo app (already set up)
- Python 3.7+ installed
- OpenCV and other Python dependencies

## 1. Flask Backend Setup

### Install Python Dependencies

```bash
pip install -r requirements.txt
```

The requirements include:
- Flask==2.3.3
- Flask-CORS==4.0.0
- opencv-python==4.8.1.78
- Pillow==10.0.1
- numpy==1.24.3

### Start Flask Server

```bash
python flask_document_processor.py
```

The server will start on `http://localhost:5000`

## 2. React Native App Setup

### Dependencies Already Installed

The following dependencies have been added to your project:
- `expo-image-picker` - For image selection and camera capture
- `expo-file-system` - For file operations and base64 conversion

### Update IP Address

1. Find your computer's IP address:
   - Windows: `ipconfig`
   - macOS/Linux: `ifconfig` or `ip addr`

2. Update the IP address in `lib/documentService.js`:
   ```javascript
   const FLASK_API_URL = 'http://YOUR_IP_ADDRESS:5000';
   ```

## 3. Supabase Database Setup

### Create the `processed_documents` table

Run this SQL in your Supabase SQL editor:

```sql
CREATE TABLE processed_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_image_url TEXT,
    processed_image_url TEXT,
    processing_type TEXT DEFAULT 'border_detection_crop',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE processed_documents ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own documents
CREATE POLICY "Users can view own documents" ON processed_documents
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own documents
CREATE POLICY "Users can insert own documents" ON processed_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own documents
CREATE POLICY "Users can update own documents" ON processed_documents
    FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own documents
CREATE POLICY "Users can delete own documents" ON processed_documents
    FOR DELETE USING (auth.uid() = user_id);
```

### Create Storage Bucket for Documents

```sql
-- Create storage bucket for processed documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true);

-- Create policy for public access to document images
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

## 4. How It Works

### Document Border Detection Algorithm

The Flask backend uses several computer vision techniques:

1. **Preprocessing**:
   - Convert to grayscale
   - Apply Gaussian blur to reduce noise
   - Apply adaptive thresholding

2. **Edge Detection**:
   - Use Canny edge detection
   - Apply morphological operations to clean edges
   - Dilate edges to make them more prominent

3. **Contour Detection**:
   - Find contours in the edge-detected image
   - Sort by area (largest first)
   - Look for 4-sided contours (rectangles/documents)

4. **Perspective Correction**:
   - Apply four-point perspective transform
   - Correct document orientation and perspective
   - Create a "bird's eye view" of the document

5. **Enhancement**:
   - Apply adaptive histogram equalization
   - Use bilateral filtering to reduce noise
   - Improve overall image quality

### Fallback Methods

If the primary detection fails, the system uses:
- Hough line detection to find document edges
- Minimal cropping with padding removal
- Alternative contour detection methods

## 5. Testing the Setup

### Test Flask Backend

1. Start the Flask server
2. Visit `http://localhost:5000/test` in your browser
3. You should see: `{"message": "Flask Document Processing server is running!"}`

### Test React Native App

1. Start your Expo app
2. Navigate to the Upload tab
3. Switch to the "Doc Scanner" tab
4. Check if the connection status shows "Connected to Processing Service"
5. Try selecting an image and processing it

## 6. Features Implemented

✅ Image selection from gallery  
✅ Camera capture  
✅ Base64 image conversion  
✅ Flask document processing API integration  
✅ Border detection using OpenCV  
✅ Automatic perspective correction  
✅ Document cropping and enhancement  
✅ Supabase database storage  
✅ Connection status monitoring  
✅ Error handling and user feedback  
✅ Loading states and progress indicators  
✅ Visual feedback showing detected borders  
✅ Before/after image comparison  

## 7. Troubleshooting

### Common Issues

**Flask server not accessible from mobile:**
- Make sure your computer and phone are on the same network
- Check if your firewall is blocking port 5000
- Verify the IP address is correct

**Border detection not working:**
- Ensure good lighting when taking photos
- Make sure the document has clear, distinct edges
- Try with high-contrast documents first
- Check that OpenCV is properly installed

**Supabase connection issues:**
- Check your Supabase credentials in `constants/index.js`
- Verify the `processed_documents` table exists and has proper RLS policies
- Check if the storage bucket exists

### Debug Mode

To enable debug logging, add console.log statements in the DocumentScanner component:

```javascript
// In DocumentScanner.jsx, add console.log statements
console.log('Processing document...');
console.log('Processing result:', data);
```

## 8. File Structure

```
supa-capsarch-app/
├── app/(tabs)/upload.jsx              # Updated Upload screen with scanner tab
├── components/DocumentScanner.jsx     # Document scanner component
├── lib/
│   ├── supabase.js                   # Supabase client
│   └── documentService.js            # Document processing API service
├── flask_document_processor.py       # Flask backend
├── requirements.txt                  # Python dependencies
└── DOCUMENT_SCANNER_SETUP.md        # This guide
```

## 9. Next Steps

- Fine-tune the edge detection parameters for better accuracy
- Add manual corner adjustment for difficult documents
- Implement batch processing for multiple documents
- Add different processing modes (grayscale, high contrast, etc.)
- Implement document type classification
- Add export options (PDF, different image formats)
- Optimize processing speed and memory usage