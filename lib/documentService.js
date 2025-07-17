// Document Processing Service for communicating with Flask backend
const FLASK_API_URL = 'http://192.168.39.50:5000'; // Update this with your actual IP

export const documentService = {
  /**
   * Send image to Flask API for document border detection and cropping
   * @param {string} base64Image - Base64 encoded image
   * @returns {Promise<Object>} - Response with processed image
   */
  async processDocument(base64Image) {
    try {
      const response = await fetch(`${FLASK_API_URL}/process-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Document processing API error:', error);
      throw error;
    }
  },

  /**
   * Test connection to Flask backend
   * @returns {Promise<boolean>} - True if connection successful
   */
  async testConnection() {
    try {
      const response = await fetch(`${FLASK_API_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  },
};

export default documentService;