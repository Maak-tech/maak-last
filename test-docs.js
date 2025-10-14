// Simple test to verify our document service works
const { documentService } = require('./lib/services/documentService');

async function testDocumentService() {
  try {
    console.log('Testing Privacy Policy loading...');
    const privacyDoc = await documentService.getPrivacyPolicy();
    console.log('✅ Privacy Policy loaded successfully');
    console.log('Title:', privacyDoc.title);
    console.log('Last Updated:', privacyDoc.lastUpdated);
    console.log('Sections:', privacyDoc.sections.length);
    
    console.log('\nTesting Terms & Conditions loading...');
    const termsDoc = await documentService.getTermsAndConditions();
    console.log('✅ Terms & Conditions loaded successfully');
    console.log('Title:', termsDoc.title);
    console.log('Last Updated:', termsDoc.lastUpdated);
    console.log('Sections:', termsDoc.sections.length);
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDocumentService();