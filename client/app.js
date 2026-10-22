const API_BASE_URL = 'http://localhost:5000';
const statusElement = document.querySelector('#api-status');

async function checkApiStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }

    statusElement.textContent = 'Ordering service is online';
    statusElement.dataset.state = 'online';
  } catch (error) {
    console.error('Unable to reach the ordering service:', error);
    statusElement.textContent = 'Ordering service is currently unavailable';
    statusElement.dataset.state = 'offline';
  }
}

checkApiStatus();
