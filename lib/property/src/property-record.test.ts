import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PropertyRecordManager } from './property-record.js';
import type {
  PropertyEvidence,
  PropertyUnderwriting,
  PropertyAudit,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDataDir = resolve(__dirname, '../test-data');
const schemasDir = resolve(__dirname, '../../../schemas');

describe('PropertyRecordManager', () => {
  let manager: PropertyRecordManager;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true });
    }
    mkdirSync(testDataDir, { recursive: true });
    manager = new PropertyRecordManager(testDataDir, schemasDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true });
    }
  });

  describe('generateId', () => {
    it('generates a slug from an address', () => {
      const id = PropertyRecordManager.generateId('123 Main St, Tampa, FL 33602');
      expect(id).toBe('123-main-st-tampa-fl-33602');
    });

    it('removes special characters', () => {
      const id = PropertyRecordManager.generateId("456 Oak Ave #5, St. Pete's, FL");
      expect(id).toBe('456-oak-ave-5-st-petes-fl');
    });

    it('truncates long addresses', () => {
      const longAddress = 'A'.repeat(100) + ', Tampa, FL';
      const id = PropertyRecordManager.generateId(longAddress);
      expect(id.length).toBeLessThanOrEqual(60);
    });
  });

  describe('create', () => {
    it('creates a new property with minimal options', () => {
      const meta = manager.create({
        id: 'test-property',
        address: '123 Test St, Tampa, FL',
        listing_url: 'https://example.com/listing/123',
      });

      expect(meta.id).toBe('test-property');
      expect(meta.address).toBe('123 Test St, Tampa, FL');
      expect(meta.workflow_state).toBe('CANDIDATE');
      expect(meta.created_at).toBeDefined();
      expect(meta.updated_at).toBeDefined();
    });

    it('creates a property with all options', () => {
      const meta = manager.create({
        id: 'test-property-full',
        address: '456 Test Ave, Tampa, FL',
        location: 'Tampa, FL',
        listing_url: 'https://example.com/listing/456',
        workflow_state: 'SCREENED',
      });

      expect(meta.id).toBe('test-property-full');
      expect(meta.location).toBe('Tampa, FL');
      expect(meta.workflow_state).toBe('SCREENED');
    });

    it('throws when property already exists', () => {
      manager.create({
        id: 'duplicate',
        address: '123 Test St',
        listing_url: 'https://example.com',
      });

      expect(() =>
        manager.create({
          id: 'duplicate',
          address: '456 Other St',
          listing_url: 'https://example.com/other',
        })
      ).toThrow('Property duplicate already exists');
    });

    it('creates the meta.json file on disk', () => {
      manager.create({
        id: 'disk-test',
        address: '123 Disk St',
        listing_url: 'https://example.com',
      });

      const metaPath = join(testDataDir, 'disk-test', 'meta.json');
      expect(existsSync(metaPath)).toBe(true);

      const content = JSON.parse(readFileSync(metaPath, 'utf-8'));
      expect(content.id).toBe('disk-test');
    });
  });

  describe('read operations', () => {
    beforeEach(() => {
      manager.create({
        id: 'read-test',
        address: '123 Read St',
        listing_url: 'https://example.com',
      });
    });

    it('reads meta file', () => {
      const meta = manager.readMeta('read-test');
      expect(meta.id).toBe('read-test');
      expect(meta.address).toBe('123 Read St');
    });

    it('throws when property does not exist', () => {
      expect(() => manager.readMeta('nonexistent')).toThrow('Property nonexistent not found');
    });

    it('returns null for missing evidence file', () => {
      const evidence = manager.readEvidence('read-test');
      expect(evidence).toBeNull();
    });

    it('reads complete property record', () => {
      const record = manager.read('read-test');
      expect(record.meta.id).toBe('read-test');
      expect(record.evidence).toBeUndefined();
      expect(record.underwriting).toBeUndefined();
      expect(record.audit).toBeUndefined();
    });
  });

  describe('exists', () => {
    it('returns true for existing property', () => {
      manager.create({
        id: 'exists-test',
        address: '123 Exists St',
        listing_url: 'https://example.com',
      });

      expect(manager.exists('exists-test')).toBe(true);
    });

    it('returns false for non-existing property', () => {
      expect(manager.exists('nonexistent')).toBe(false);
    });
  });

  describe('listProperties', () => {
    it('returns empty array when no properties exist', () => {
      const properties = manager.listProperties();
      expect(properties).toEqual([]);
    });

    it('lists all property IDs', () => {
      manager.create({ id: 'prop-1', address: 'Address 1', listing_url: 'https://example.com/1' });
      manager.create({ id: 'prop-2', address: 'Address 2', listing_url: 'https://example.com/2' });
      manager.create({ id: 'prop-3', address: 'Address 3', listing_url: 'https://example.com/3' });

      const properties = manager.listProperties();
      expect(properties).toHaveLength(3);
      expect(properties).toContain('prop-1');
      expect(properties).toContain('prop-2');
      expect(properties).toContain('prop-3');
    });
  });

  describe('updateMeta', () => {
    beforeEach(() => {
      manager.create({
        id: 'update-test',
        address: '123 Update St',
        listing_url: 'https://example.com',
      });
    });

    it('updates meta fields', () => {
      const updated = manager.updateMeta('update-test', {
        location: 'Tampa, FL',
        workflow_state: 'SCREENED',
        scout_decision: 'RESEARCH',
      });

      expect(updated.location).toBe('Tampa, FL');
      expect(updated.workflow_state).toBe('SCREENED');
      expect(updated.scout_decision).toBe('RESEARCH');
    });

    it('preserves id and created_at', () => {
      const original = manager.readMeta('update-test');

      const updated = manager.updateMeta('update-test', {
        id: 'should-be-ignored',
        created_at: '1999-01-01T00:00:00Z',
        location: 'Updated',
      });

      expect(updated.id).toBe('update-test');
      expect(updated.created_at).toBe(original.created_at);
    });

    it('updates updated_at timestamp', () => {
      const original = manager.readMeta('update-test');

      // Small delay to ensure different timestamp
      const updated = manager.updateMeta('update-test', { location: 'New Location' });

      expect(updated.updated_at).not.toBe(original.updated_at);
    });
  });

  describe('writeEvidence', () => {
    beforeEach(() => {
      manager.create({
        id: 'evidence-test',
        address: '123 Evidence St',
        listing_url: 'https://example.com',
      });
    });

    it('writes valid evidence file', () => {
      const evidence: PropertyEvidence = {
        property_id: 'evidence-test',
        researched_at: new Date().toISOString(),
        purchase_price: {
          value: 200000,
          status: 'VERIFIED',
          confidence: 'HIGH',
          source: 'https://example.com',
          evidence: 'Listing price',
        },
      };

      const result = manager.writeEvidence('evidence-test', evidence);
      expect(result.valid).toBe(true);

      const read = manager.readEvidence('evidence-test');
      expect(read?.purchase_price?.value).toBe(200000);
    });

    it('returns validation errors for invalid evidence', () => {
      const invalidEvidence = {
        property_id: 'evidence-test',
        // missing researched_at
      } as PropertyEvidence;

      const result = manager.writeEvidence('evidence-test', invalidEvidence);
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('throws when property does not exist', () => {
      const evidence: PropertyEvidence = {
        property_id: 'nonexistent',
        researched_at: new Date().toISOString(),
      };

      expect(() => manager.writeEvidence('nonexistent', evidence)).toThrow(
        'Property nonexistent not found'
      );
    });
  });

  describe('writeUnderwriting', () => {
    beforeEach(() => {
      manager.create({
        id: 'underwriting-test',
        address: '123 Underwriting St',
        listing_url: 'https://example.com',
      });
    });

    it('writes valid underwriting file', () => {
      const underwriting: PropertyUnderwriting = {
        property_id: 'underwriting-test',
        annual_gross_rent: 26400,
        annual_operating_expenses: 12000,
        noi: 14400,
        cap_rate: 0.072,
        proposed_status: 'WATCHLIST',
        computed_at: new Date().toISOString(),
      };

      const result = manager.writeUnderwriting('underwriting-test', underwriting);
      expect(result.valid).toBe(true);

      const read = manager.readUnderwriting('underwriting-test');
      expect(read?.noi).toBe(14400);
    });
  });

  describe('writeAudit', () => {
    beforeEach(() => {
      manager.create({
        id: 'audit-test',
        address: '123 Audit St',
        listing_url: 'https://example.com',
      });
    });

    it('writes valid audit file', () => {
      const audit: PropertyAudit = {
        property_id: 'audit-test',
        result: 'PASS',
        final_status: 'VIABLE',
        findings: [],
        audited_at: new Date().toISOString(),
      };

      const result = manager.writeAudit('audit-test', audit);
      expect(result.valid).toBe(true);

      const read = manager.readAudit('audit-test');
      expect(read?.result).toBe('PASS');
    });
  });

  describe('transitionState', () => {
    beforeEach(() => {
      manager.create({
        id: 'transition-test',
        address: '123 Transition St',
        listing_url: 'https://example.com',
        workflow_state: 'CANDIDATE',
      });
    });

    it('allows valid state transitions', () => {
      let meta = manager.transitionState('transition-test', 'SCREENED');
      expect(meta.workflow_state).toBe('SCREENED');

      meta = manager.transitionState('transition-test', 'RESEARCHING');
      expect(meta.workflow_state).toBe('RESEARCHING');
    });

    it('throws on invalid state transition', () => {
      expect(() => manager.transitionState('transition-test', 'PUBLISHED')).toThrow(
        'Invalid state transition: CANDIDATE → PUBLISHED'
      );
    });

    it('allows audit to route back to researching', () => {
      manager.updateMeta('transition-test', { workflow_state: 'AUDIT' });

      const meta = manager.transitionState('transition-test', 'RESEARCHING');
      expect(meta.workflow_state).toBe('RESEARCHING');
    });
  });

  describe('getByState', () => {
    beforeEach(() => {
      manager.create({
        id: 'state-1',
        address: 'Address 1',
        listing_url: 'https://example.com/1',
        workflow_state: 'CANDIDATE',
      });
      manager.create({
        id: 'state-2',
        address: 'Address 2',
        listing_url: 'https://example.com/2',
        workflow_state: 'SCREENED',
      });
      manager.create({
        id: 'state-3',
        address: 'Address 3',
        listing_url: 'https://example.com/3',
        workflow_state: 'CANDIDATE',
      });
    });

    it('returns properties in specified state', () => {
      const candidates = manager.getByState('CANDIDATE');
      expect(candidates).toHaveLength(2);
      expect(candidates).toContain('state-1');
      expect(candidates).toContain('state-3');
    });

    it('returns empty array when no properties in state', () => {
      const published = manager.getByState('PUBLISHED');
      expect(published).toEqual([]);
    });
  });

  describe('validateProperty', () => {
    it('validates all files for a property', () => {
      manager.create({
        id: 'validate-test',
        address: '123 Validate St',
        listing_url: 'https://example.com',
      });

      manager.writeEvidence('validate-test', {
        property_id: 'validate-test',
        researched_at: new Date().toISOString(),
      });

      const results = manager.validateProperty('validate-test');
      expect(results.meta.valid).toBe(true);
      expect(results.evidence?.valid).toBe(true);
      expect(results.underwriting).toBeNull();
      expect(results.audit).toBeNull();
      expect(results.allValid).toBe(true);
    });
  });

  describe('reading _example property', () => {
    it('can read the _example property from main data dir', () => {
      const realManager = new PropertyRecordManager(
        resolve(__dirname, '../../../data/properties'),
        schemasDir
      );

      const record = realManager.read('_example');
      expect(record.meta.id).toBe('_example');
      expect(record.evidence?.purchase_price?.value).toBe(200000);
      expect(record.underwriting?.noi).toBe(13828);
      expect(record.audit?.result).toBe('PASS');
    });

    it('validates all files in _example property', () => {
      const realManager = new PropertyRecordManager(
        resolve(__dirname, '../../../data/properties'),
        schemasDir
      );

      const results = realManager.validateProperty('_example');
      expect(results.allValid).toBe(true);
    });
  });
});
