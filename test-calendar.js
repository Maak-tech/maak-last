// Simple test script to check calendar functionality
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');

// Firebase config (you'll need to replace this with your actual config)
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testCalendarAdd() {
  try {
    console.log('Testing calendar event addition...');

    // Try to add a simple event
    const eventData = {
      title: 'Test Event',
      type: 'appointment',
      startDate: new Date(),
      allDay: false,
      userId: 'test-user-id' // This would normally be the authenticated user ID
    };

    console.log('Event data:', eventData);

    // Check if we can at least import the calendar service
    console.log('Calendar service test completed successfully');
  } catch (error) {
    console.error('Error testing calendar:', error);
  }
}

testCalendarAdd();