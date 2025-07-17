import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { documentService } from '../lib/documentService';
import { supabase } from '../lib/supabase';

export default function DocumentScanner() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [originalWithDetection, setOriginalWithDetection] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [isConnected, setIsConnected] = useState(false);

  // Check connection to Flask backend on component mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const connected = await documentService.testConnection();
      setIsConnected(connected);
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
    }
  };

  // Request permissions for image picker
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to make this work!'
      );
      return false;
    }
    return true;
  };

  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setProcessedImage(null);
        setOriginalWithDetection(null);
        setStatus('idle');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera permissions to make this work!'
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setProcessedImage(null);
        setOriginalWithDetection(null);
        setStatus('idle');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Convert image to base64
  const imageToBase64 = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error('Error converting to base64:', error);
      throw error;
    }
  };

  // Send image to Flask Document Processing API
  const processDocument = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first.');
      return;
    }

    if (!isConnected) {
      Alert.alert(
        'Connection Error',
        'Cannot connect to document processing service. Please check your Flask backend is running and try again.'
      );
      return;
    }

    setIsProcessing(true);
    setStatus('loading');

    try {
      // Get base64 from selected image
      const base64Image = selectedImage.base64 || await imageToBase64(selectedImage.uri);
      
      // Use document service
      const data = await documentService.processDocument(base64Image);
      
      if (data.processed_image) {
        setProcessedImage(`data:image/jpeg;base64,${data.processed_image}`);
        setOriginalWithDetection(`data:image/jpeg;base64,${data.original_with_detection}`);
        setStatus('success');
      } else {
        throw new Error('No processed image returned');
      }
    } catch (error) {
      console.error('Document processing error:', error);
      setStatus('error');
      Alert.alert(
        'Processing Error',
        'Failed to process the document. Please check your Flask backend is running and try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Save to Supabase
  const saveToSupabase = async () => {
    if (!processedImage) {
      Alert.alert('No Processed Image', 'Please process a document first.');
      return;
    }

    setIsLoading(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Convert processed image back to base64 for storage
      const base64Data = processedImage.replace('data:image/jpeg;base64,', '');

      // Upload processed image to Supabase Storage
      let imageUrl = null;
      const fileName = `processed_doc_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, base64Data, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.warn('Image upload failed:', uploadError);
        // Continue without image URL
      } else {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // Insert document data into database
      const { data, error } = await supabase
        .from('processed_documents')
        .insert([
          {
            user_id: user.id,
            original_image_url: null, // Could store original too if needed
            processed_image_url: imageUrl,
            processing_type: 'border_detection_crop',
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success',
        'Document processed and saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSelectedImage(null);
              setProcessedImage(null);
              setOriginalWithDetection(null);
              setStatus('idle');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Supabase save error:', error);
      Alert.alert(
        'Save Error',
        'Failed to save the processed document. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Document Scanner</Text>
        <Text style={styles.subtitle}>Auto-detect borders and crop documents</Text>
      </View>

      {/* Connection Status */}
      <View style={styles.connectionContainer}>
        <View style={styles.connectionItem}>
          <Ionicons 
            name={isConnected ? "checkmark-circle" : "close-circle"} 
            size={16} 
            color={isConnected ? "#4CAF50" : "#F44336"} 
          />
          <Text style={[styles.connectionText, { color: isConnected ? '#4CAF50' : '#F44336' }]}>
            {isConnected ? 'Connected to Processing Service' : 'Processing Service Unavailable'}
          </Text>
        </View>
        {!isConnected && (
          <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
            <Ionicons name="refresh" size={16} color="#35359e" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Image Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Select Document Image</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Ionicons name="images-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selected Image */}
      {selectedImage && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Image</Text>
          <Image source={{ uri: selectedImage.uri }} style={styles.image} />
          <TouchableOpacity
            style={[styles.processButton, isProcessing && styles.disabledButton]}
            onPress={processDocument}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="crop-outline" size={20} color="#fff" />
                <Text style={styles.processButtonText}>Detect & Crop</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Status Indicator */}
      {status !== 'idle' && (
        <View style={styles.statusContainer}>
          {status === 'loading' && (
            <View style={styles.statusItem}>
              <ActivityIndicator size="small" color="#35359e" />
              <Text style={styles.statusText}>Processing document...</Text>
            </View>
          )}
          {status === 'success' && (
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                Document processed successfully!
              </Text>
            </View>
          )}
          {status === 'error' && (
            <View style={styles.statusItem}>
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={[styles.statusText, { color: '#F44336' }]}>
                Failed to process document
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Detection Visualization */}
      {originalWithDetection && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Border Detection</Text>
          <Text style={styles.sectionSubtitle}>Green lines show detected document edges</Text>
          <Image source={{ uri: originalWithDetection }} style={styles.image} />
        </View>
      )}

      {/* Processed Image */}
      {processedImage && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Cropped Document</Text>
          <Image source={{ uri: processedImage }} style={styles.image} />
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.disabledButton]}
            onPress={saveToSupabase}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: '#35359e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 120,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
  },
  processButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#35359e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  statusContainer: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  connectionContainer: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  connectionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0ff',
  },
  retryText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#35359e',
    fontWeight: '500',
  },
});