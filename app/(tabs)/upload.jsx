import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function UploadScreen() {
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [videoCode, setVideoCode] = useState('');
  const [pdf, setPdf] = useState(null);
  const [agreed, setAgreed] = useState(false);

  // Placeholder for PDF upload logic
  const handlePdfUpload = () => {
    // TODO: Implement file picker and upload logic
    alert('PDF upload not implemented');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Project</Text>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={[styles.form, { padding: 10, paddingTop: 10 }]}> 
        {/* Project Title */}
        <Text style={styles.label}>Project Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter project title"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />
        {/* Abstract */}
        <Text style={styles.label}>Abstract</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Enter project abstract"
          placeholderTextColor="#888"
          value={abstract}
          onChangeText={setAbstract}
          multiline
          numberOfLines={4}
        />
        {/* Source Code Link */}
        <Text style={styles.label}>Source Code Link</Text>
        <TextInput
          style={styles.input}
          placeholder="GitHub repository URL"
          placeholderTextColor="#888"
          value={sourceCode}
          onChangeText={setSourceCode}
        />
        {/* Video Code Link */}
        <Text style={styles.label}>Video Code Link</Text>
        <TextInput
          style={styles.input}
          placeholder="Youtube video URL"
          placeholderTextColor="#888"
          value={videoCode}
          onChangeText={setVideoCode}
        />
        {/* Project PDF */}
        <Text style={styles.label}>Project PDF</Text>
        <Pressable style={styles.pdfBox} onPress={handlePdfUpload}>
          <Text style={styles.pdfText}>Tap to upload your project PDF{Platform.OS === 'web' ? '' : '\n'}
            <Text style={{ color: '#888', fontSize: 12 }}>
              {'\n'}Maximum file size: 10MB
            </Text>
          </Text>
        </Pressable>
        {/* Terms and Conditions */}
        <View style={styles.checkboxRow}>
          <TouchableOpacity onPress={() => setAgreed(!agreed)} style={styles.checkbox}>
            {agreed ? <Ionicons name="checkbox" size={22} color="#35359e" /> : <Ionicons name="square-outline" size={22} color="#35359e" />}
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>
            I confirm that this project is my original work and I have the right to publish it. I agree to the terms and conditions.
          </Text>
        </View>
        {/* Upload Button */}
        <TouchableOpacity style={styles.uploadBtn} disabled={!agreed}>
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#35359e',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  form: {
    flexGrow: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pdfBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  pdfText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 20,
  },
  checkbox: {
    marginRight: 10,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  uploadBtn: {
    backgroundColor: '#35359e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
};