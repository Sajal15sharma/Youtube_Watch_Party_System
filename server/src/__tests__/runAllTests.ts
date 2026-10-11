import { runRbacVerification } from '../utils/rbacVerification.js';
import { runSyncAndIsolationTests } from './synchronizationAndIsolation.test.js';
import { runFullSystemTestSuite } from './fullSystemTestSuite.test.js';

async function main() {
  console.log('=== RUNNING SERVER TEST SUITE ===\n');
  runRbacVerification();
  console.log('\n-----------------------------------\n');
  await runSyncAndIsolationTests();
  console.log('\n-----------------------------------\n');
  await runFullSystemTestSuite();
  console.log('\n=== ALL SERVER TESTS EXECUTED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
