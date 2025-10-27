// Set environment to use development database
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

const { storage } = require('./server/storage.ts');

(async () => {
  try {
    console.log('Checking purchase request ID 75...');
    
    const pr = await storage.getPurchaseRequestById(75);
    if (pr) {
      console.log('Purchase Request ID 75:');
      console.log('Phase:', pr.phase);
      console.log('Current Phase:', pr.currentPhase);
      console.log('Approved A2:', pr.approvedA2);
      console.log('Request Number:', pr.requestNumber);
      console.log('Approval Date A2:', pr.approvalDateA2);
      
      // Check if it meets the criteria for A2 PDF
      const hasApprovalA2Pdf = pr.phase === 'approval_a2' || 
                              pr.phase === 'purchase_order' || 
                              pr.phase === 'conclusion' || 
                              pr.phase === 'receipt' || 
                              pr.phase === 'archived';
      
      console.log('Should have A2 PDF available:', hasApprovalA2Pdf);
      
    } else {
      console.log('Purchase request 75 not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();