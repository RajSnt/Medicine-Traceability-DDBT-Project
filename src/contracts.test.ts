import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import {
  MedicineTraceabilityEngine,
} from './lib/contractEngine';
import {
  Role,
  encodeBatchId,
  CONTRACT_CONFIG,
  parseContractError,
  INTERFACES,
} from './lib/contracts';

test('BE-T01: Deployer becomes admin in RoleManager', () => {
  const engine = new MedicineTraceabilityEngine();
  assert.equal(engine.admin, ethers.getAddress(CONTRACT_CONFIG.demoAccounts.admin));
  assert.equal(engine.getRole(engine.admin), Role.Admin);
  assert.equal(engine.hasRole(engine.admin, Role.Admin), true);
});

test('BE-T02: Admin registers supply chain actors', () => {
  const engine = new MedicineTraceabilityEngine();
  const testMfg = '0x1111111111111111111111111111111111111111';
  const testDist = '0x2222222222222222222222222222222222222222';

  engine.registerRole(engine.admin, testMfg, Role.Manufacturer);
  engine.registerRole(engine.admin, testDist, Role.Distributor);

  assert.equal(engine.getRole(testMfg), Role.Manufacturer);
  assert.equal(engine.getRole(testDist), Role.Distributor);
});

test('BE-T03: Non-admin cannot assign a role (reverts with UnauthorizedAdmin)', () => {
  const engine = new MedicineTraceabilityEngine();
  const nonAdmin = CONTRACT_CONFIG.demoAccounts.manufacturer;
  const target = '0x3333333333333333333333333333333333333333';

  assert.throws(
    () => engine.registerRole(nonAdmin, target, Role.Pharmacy),
    (err: any) => err.message.includes('UnauthorizedAdmin')
  );
});

test('BE-T04: Reject zero role address (reverts with InvalidAccount)', () => {
  const engine = new MedicineTraceabilityEngine();
  assert.throws(
    () => engine.registerRole(engine.admin, ethers.ZeroAddress, Role.Pharmacy),
    (err: any) => err.message.includes('InvalidAccount')
  );
});

test('BE-T05: Manufacturer creates batch successfully', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = CONTRACT_CONFIG.demoAccounts.manufacturer;
  const rawId = 'BATCH-TEST-001';

  const receipt = engine.registerBatch(mfg, rawId, 'Amoxicillin 500mg', 'Lot 4481');
  assert.equal(receipt.status, 1);
  assert.equal(engine.batchExists(rawId), true);

  const batch = engine.getBatch(rawId);
  assert.equal(batch.medicineName, 'Amoxicillin 500mg');
  assert.equal(batch.batchMetadata, 'Lot 4481');
  assert.equal(batch.manufacturer, ethers.getAddress(mfg));
  assert.equal(batch.exists, true);
});

test('BE-T06: Non-manufacturer cannot create batch (reverts with UnauthorizedManufacturer)', () => {
  const engine = new MedicineTraceabilityEngine();
  const dist = CONTRACT_CONFIG.demoAccounts.distributor;

  assert.throws(
    () => engine.registerBatch(dist, 'BATCH-FAIL', 'Aspirin', 'Lot 1'),
    (err: any) => err.message.includes('UnauthorizedManufacturer')
  );
});

test('BE-T07: Duplicate batch ID is rejected (reverts with DuplicateBatch)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = CONTRACT_CONFIG.demoAccounts.manufacturer;

  engine.registerBatch(mfg, 'BATCH-DUP', 'Paracetamol', 'Batch A');
  assert.throws(
    () => engine.registerBatch(mfg, 'BATCH-DUP', 'Paracetamol', 'Batch B'),
    (err: any) => err.message.includes('DuplicateBatch')
  );
});

test('BE-T08: Invalid batch input rejected (reverts with InvalidBatchId or EmptyMedicineName)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = CONTRACT_CONFIG.demoAccounts.manufacturer;

  // Empty medicine name
  assert.throws(
    () => engine.registerBatch(mfg, 'BATCH-EMPTY-NAME', '', 'Metadata'),
    (err: any) => err.message.includes('EmptyMedicineName')
  );
});

test('BE-T09: Initial custodian is manufacturer and history has creation entry', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const rawId = 'BATCH-CUSTODY-01';

  engine.registerBatch(mfg, rawId, 'Ibuprofen 400mg', 'Lot 99');
  assert.equal(engine.getCurrentCustodian(rawId), mfg);

  const history = engine.getCustodyHistory(rawId);
  assert.equal(history.length, 1);
  assert.equal(history[0].from, ethers.ZeroAddress);
  assert.equal(history[0].to, mfg);
});

test('BE-T10, T11, T12: Sequential transfers (Mfg -> Dist -> Pharmacy -> Patient)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const dist = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);
  const pharm = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.pharmacy);
  const patient = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.patient);
  const rawId = 'BATCH-FULL-FLOW';

  // 1. Create batch
  engine.registerBatch(mfg, rawId, 'Insulin Glargine', 'Cold chain 2-8C');

  // 2. Transfer Mfg -> Dist (BE-T10)
  const tx1 = engine.transferCustody(mfg, rawId, dist);
  assert.equal(tx1.status, 1);
  assert.equal(engine.getCurrentCustodian(rawId), dist);

  // 3. Transfer Dist -> Pharmacy (BE-T11)
  const tx2 = engine.transferCustody(dist, rawId, pharm);
  assert.equal(tx2.status, 1);
  assert.equal(engine.getCurrentCustodian(rawId), pharm);

  // 4. Transfer Pharmacy -> Patient (BE-T12)
  const tx3 = engine.transferCustody(pharm, rawId, patient);
  assert.equal(tx3.status, 1);
  assert.equal(engine.getCurrentCustodian(rawId), patient);

  // Verify total history length = 4 (creation + 3 transfers)
  const history = engine.getCustodyHistory(rawId);
  assert.equal(history.length, 4);
  assert.equal(history[1].from, mfg);
  assert.equal(history[1].to, dist);
  assert.equal(history[2].from, dist);
  assert.equal(history[2].to, pharm);
  assert.equal(history[3].from, pharm);
  assert.equal(history[3].to, patient);
});

test('BE-T13: Non-custodian transfer is rejected (reverts with UnauthorizedCustodian)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const dist = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);
  const pharm = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.pharmacy);
  const rawId = 'BATCH-UNAUTH-TRANSFER';

  engine.registerBatch(mfg, rawId, 'Metformin 850mg', 'Lot 12');

  // Distributor tries to transfer before having custody
  assert.throws(
    () => engine.transferCustody(dist, rawId, pharm),
    (err: any) => err.message.includes('UnauthorizedCustodian')
  );
});

test('BE-T14: Invalid role transition (e.g. Manufacturer skipping straight to Patient)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const patient = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.patient);
  const rawId = 'BATCH-SKIP-JUMP';

  engine.registerBatch(mfg, rawId, 'Atorvastatin 20mg', 'Lot 88');

  assert.throws(
    () => engine.transferCustody(mfg, rawId, patient),
    (err: any) => err.message.includes('InvalidRoleTransition')
  );
});

test('BE-T15: Zero recipient rejected (reverts with InvalidRecipient)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const rawId = 'BATCH-ZERO-RECIP';

  engine.registerBatch(mfg, rawId, 'Lisinopril 10mg', 'Lot 55');

  assert.throws(
    () => engine.transferCustody(mfg, rawId, ethers.ZeroAddress),
    (err: any) => err.message.includes('InvalidRecipient')
  );
});

test('BE-T16: Unknown batch transfer rejected (reverts with UnknownBatch)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const dist = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);

  assert.throws(
    () => engine.transferCustody(mfg, 'BATCH-NONEXISTENT', dist),
    (err: any) => err.message.includes('UnknownBatch')
  );
});

test('BE-T17: Patient is terminal (cannot transfer onward)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const dist = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);
  const pharm = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.pharmacy);
  const patient = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.patient);
  const rawId = 'BATCH-TERMINAL';

  engine.registerBatch(mfg, rawId, 'Levothyroxine 50mcg', 'Lot 33');
  engine.transferCustody(mfg, rawId, dist);
  engine.transferCustody(dist, rawId, pharm);
  engine.transferCustody(pharm, rawId, patient);

  // Patient tries to transfer anywhere
  assert.throws(
    () => engine.transferCustody(patient, rawId, mfg),
    (err: any) => err.message.includes('TerminalRole')
  );
});

test('BE-T18 & BE-T22: Public batch lookup and authenticity check', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const knownId = 'BATCH-KNOWN-001';
  const unknownId = 'BATCH-UNKNOWN-999';

  engine.registerBatch(mfg, knownId, 'Cetirizine 10mg', 'Lot 7');

  assert.equal(engine.batchExists(knownId), true);
  assert.equal(engine.batchExists(unknownId), false);

  const knownBatch = engine.getBatch(knownId);
  assert.equal(knownBatch.exists, true);
  assert.equal(knownBatch.medicineName, 'Cetirizine 10mg');

  const unknownBatch = engine.getBatch(unknownId);
  assert.equal(unknownBatch.exists, false);
});

test('BE-T19 & BE-T21: Custody history integrity (failed transfer adds no record)', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const dist = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);
  const rawId = 'BATCH-INTEGRITY';

  engine.registerBatch(mfg, rawId, 'Omeprazole 20mg', 'Lot 99');
  const countBefore = engine.getCustodyHistory(rawId).length;

  // Failing transfer
  assert.throws(() => engine.transferCustody(dist, rawId, mfg));

  const countAfter = engine.getCustodyHistory(rawId).length;
  assert.equal(countBefore, countAfter);
  assert.equal(countAfter, 1);
});

test('BE-T20: Event logs emit CustodyTransferred with indexed fields', () => {
  const engine = new MedicineTraceabilityEngine();
  const mfg = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.manufacturer);
  const dist = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);
  const rawId = 'BATCH-EVENT-CHECK';

  engine.registerBatch(mfg, rawId, 'Doxycycline 100mg', 'Lot 10');
  const receipt = engine.transferCustody(mfg, rawId, dist);

  assert.equal(receipt.events.length, 1);
  const event = receipt.events[0];
  assert.equal(event.name, 'CustodyTransferred');
  assert.equal(event.args.from, mfg);
  assert.equal(event.args.to, dist);
  assert.equal(event.args.batchId, encodeBatchId(rawId));
});

test('Batch ID encoding rule matches ethers.id("BATCH-001")', () => {
  const humanId = 'BATCH-001';
  const encoded = encodeBatchId(humanId);
  const expected = ethers.id('BATCH-001');

  assert.equal(encoded, expected);
  assert.equal(encoded.length, 66);
  assert.equal(encoded.startsWith('0x'), true);

  // Hex passthrough
  assert.equal(encodeBatchId(expected), expected);
});

test('Deployment wiring rule: setter can only be called once by admin', () => {
  const engine = new MedicineTraceabilityEngine();
  const admin = engine.admin;
  const nonAdmin = ethers.getAddress(CONTRACT_CONFIG.demoAccounts.distributor);

  // Second call must fail
  assert.throws(
    () => engine.setCustodyTracker(admin, '0x4444444444444444444444444444444444444444'),
    (err: any) => err.message.includes('TrackerAlreadyConfigured')
  );

  // Non-admin call fails
  assert.throws(
    () => engine.setCustodyTracker(nonAdmin, '0x4444444444444444444444444444444444444444'),
    (err: any) => err.message.includes('OnlyAdmin')
  );
});
