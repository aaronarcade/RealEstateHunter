import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemaValidator } from './validator.js';
import type {
  FieldValue,
  PropertyMeta,
  PropertyEvidence,
  PropertyUnderwriting,
  PropertyAudit,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(__dirname, '../../../schemas');

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeAll(() => {
    validator = new SchemaValidator(schemasDir);
  });

  describe('FieldValue schema', () => {
    it('validates a complete verified field value', () => {
      const fieldValue: FieldValue = {
        value: 485,
        status: 'VERIFIED',
        confidence: 'HIGH',
        source: 'https://example.com/listing',
        evidence: 'Listing states HOA fee of $485/month',
      };

      const result = validator.validateFieldValue(fieldValue);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('validates a field value with null value for UNKNOWN status', () => {
      const fieldValue: FieldValue = {
        value: null,
        status: 'UNKNOWN',
        confidence: 'LOW',
      };

      const result = validator.validateFieldValue(fieldValue);
      expect(result.valid).toBe(true);
    });

    it('validates an estimated field value with range', () => {
      const fieldValue: FieldValue = {
        value: 2200,
        status: 'ESTIMATED',
        confidence: 'MEDIUM',
        source: 'Rent comps',
        evidence: 'Based on similar units',
        range_low: 2100,
        range_high: 2300,
      };

      const result = validator.validateFieldValue(fieldValue);
      expect(result.valid).toBe(true);
    });

    it('rejects field value with invalid status', () => {
      const fieldValue = {
        value: 100,
        status: 'INVALID_STATUS',
        confidence: 'HIGH',
      };

      const result = validator.validateFieldValue(fieldValue);
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('rejects field value missing required status field', () => {
      const fieldValue = {
        value: 100,
        confidence: 'HIGH',
      };

      const result = validator.validateFieldValue(fieldValue);
      expect(result.valid).toBe(false);
    });

    it('rejects field value with extra properties', () => {
      const fieldValue = {
        value: 100,
        status: 'VERIFIED',
        confidence: 'HIGH',
        extraField: 'not allowed',
      };

      const result = validator.validateFieldValue(fieldValue);
      expect(result.valid).toBe(false);
    });
  });

  describe('PropertyMeta schema', () => {
    it('validates a complete meta record', () => {
      const meta: PropertyMeta = {
        id: '123-main-st-tampa-fl',
        address: '123 Main St, Tampa, FL 33602',
        location: 'Tampa, FL',
        listing_url: 'https://example.com/listing/123',
        workflow_state: 'CANDIDATE',
        created_at: '2026-08-09T12:00:00Z',
        updated_at: '2026-08-09T12:00:00Z',
      };

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(true);
    });

    it('validates meta with scout_decision', () => {
      const meta: PropertyMeta = {
        id: '123-main-st-tampa-fl',
        address: '123 Main St, Tampa, FL 33602',
        listing_url: 'https://example.com/listing/123',
        workflow_state: 'SCREENED',
        scout_decision: 'RESEARCH',
        created_at: '2026-08-09T12:00:00Z',
        updated_at: '2026-08-09T12:00:00Z',
      };

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(true);
    });

    it('validates all workflow states', () => {
      const states = [
        'CANDIDATE',
        'SCREENED',
        'RESEARCHING',
        'READY_FOR_UNDERWRITING',
        'UNDERWRITTEN',
        'AUDIT',
        'RANKED',
        'PUBLISHED',
      ];

      for (const state of states) {
        const meta = {
          id: 'test',
          address: 'Test Address',
          listing_url: 'https://example.com',
          workflow_state: state,
          created_at: '2026-08-09T12:00:00Z',
          updated_at: '2026-08-09T12:00:00Z',
        };

        const result = validator.validateMeta(meta);
        expect(result.valid, `State ${state} should be valid`).toBe(true);
      }
    });

    it('rejects invalid workflow state', () => {
      const meta = {
        id: 'test',
        address: 'Test Address',
        listing_url: 'https://example.com',
        workflow_state: 'INVALID_STATE',
        created_at: '2026-08-09T12:00:00Z',
        updated_at: '2026-08-09T12:00:00Z',
      };

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(false);
    });

    it('rejects meta missing required fields', () => {
      const meta = {
        id: 'test',
        address: 'Test Address',
        // missing listing_url, workflow_state, created_at, updated_at
      };

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(false);
    });
  });

  describe('PropertyEvidence schema', () => {
    it('validates a complete evidence record', () => {
      const evidence: PropertyEvidence = {
        property_id: '_example',
        researched_at: '2026-08-09T14:00:00Z',
        purchase_price: {
          value: 200000,
          status: 'VERIFIED',
          confidence: 'HIGH',
          source: 'https://example.com/listing',
          evidence: 'Listing asking price',
        },
        monthly_rent: {
          value: 2200,
          status: 'ESTIMATED',
          confidence: 'MEDIUM',
          source: 'Rent comps',
          evidence: 'Based on similar units',
        },
        hoa_monthly: {
          value: 485,
          status: 'VERIFIED',
          confidence: 'HIGH',
          source: 'https://example.com/listing',
          evidence: 'Listing states HOA',
        },
        special_assessments: {
          value: 0,
          status: 'VERIFIED',
          confidence: 'HIGH',
          source: 'HOA docs',
          evidence: 'No current assessments',
        },
      };

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(true);
    });

    it('validates minimal evidence record', () => {
      const evidence: PropertyEvidence = {
        property_id: 'test',
        researched_at: '2026-08-09T14:00:00Z',
      };

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(true);
    });

    it('validates evidence with notes', () => {
      const evidence: PropertyEvidence = {
        property_id: 'test',
        researched_at: '2026-08-09T14:00:00Z',
        notes: 'Additional research notes',
      };

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(true);
    });

    it('rejects evidence missing required fields', () => {
      const evidence = {
        property_id: 'test',
        // missing researched_at
      };

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(false);
    });

    it('rejects evidence with extra properties', () => {
      const evidence = {
        property_id: 'test',
        researched_at: '2026-08-09T14:00:00Z',
        unknownField: 'not allowed',
      };

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(false);
    });
  });

  describe('PropertyUnderwriting schema', () => {
    it('validates a complete underwriting record', () => {
      const underwriting: PropertyUnderwriting = {
        property_id: '_example',
        annual_gross_rent: 26400,
        annual_operating_expenses: 12572,
        noi: 13828,
        cap_rate: 0.0691,
        proposed_status: 'REJECTED',
        proposed_status_reason: 'Cap rate below 10% threshold',
        input_summary: {
          purchase_price: { status: 'VERIFIED', confidence: 'HIGH' },
          monthly_rent: { status: 'ESTIMATED', confidence: 'MEDIUM' },
        },
        computed_at: '2026-08-09T16:00:00Z',
      };

      const result = validator.validateUnderwriting(underwriting);
      expect(result.valid).toBe(true);
    });

    it('validates minimal underwriting record', () => {
      const underwriting: PropertyUnderwriting = {
        property_id: 'test',
        annual_gross_rent: 30000,
        annual_operating_expenses: 10000,
        noi: 20000,
        cap_rate: 0.1,
        proposed_status: 'VIABLE',
        computed_at: '2026-08-09T16:00:00Z',
      };

      const result = validator.validateUnderwriting(underwriting);
      expect(result.valid).toBe(true);
    });

    it('validates all proposed status values', () => {
      const statuses = ['VIABLE', 'WATCHLIST', 'REJECTED'];

      for (const status of statuses) {
        const underwriting = {
          property_id: 'test',
          annual_gross_rent: 30000,
          annual_operating_expenses: 10000,
          noi: 20000,
          cap_rate: 0.1,
          proposed_status: status,
          computed_at: '2026-08-09T16:00:00Z',
        };

        const result = validator.validateUnderwriting(underwriting);
        expect(result.valid, `Status ${status} should be valid`).toBe(true);
      }
    });

    it('rejects negative cap_rate', () => {
      const underwriting = {
        property_id: 'test',
        annual_gross_rent: 30000,
        annual_operating_expenses: 10000,
        noi: 20000,
        cap_rate: -0.1,
        proposed_status: 'REJECTED',
        computed_at: '2026-08-09T16:00:00Z',
      };

      const result = validator.validateUnderwriting(underwriting);
      expect(result.valid).toBe(false);
    });

    it('rejects underwriting missing required fields', () => {
      const underwriting = {
        property_id: 'test',
        annual_gross_rent: 30000,
        // missing other required fields
      };

      const result = validator.validateUnderwriting(underwriting);
      expect(result.valid).toBe(false);
    });
  });

  describe('PropertyAudit schema', () => {
    it('validates a complete audit record', () => {
      const audit: PropertyAudit = {
        property_id: '_example',
        result: 'PASS',
        final_status: 'REJECTED',
        underwriter_proposed_status: 'REJECTED',
        findings: [
          {
            severity: 'info',
            field: 'cap_rate',
            message: 'Cap rate correctly calculated',
          },
        ],
        audited_at: '2026-08-09T18:00:00Z',
      };

      const result = validator.validateAudit(audit);
      expect(result.valid).toBe(true);
    });

    it('validates minimal audit record', () => {
      const audit: PropertyAudit = {
        property_id: 'test',
        result: 'PASS',
        final_status: 'VIABLE',
        audited_at: '2026-08-09T18:00:00Z',
      };

      const result = validator.validateAudit(audit);
      expect(result.valid).toBe(true);
    });

    it('validates all audit result values', () => {
      const results = ['PASS', 'NEEDS_RESEARCH', 'DOWNGRADE'];

      for (const auditResult of results) {
        const audit = {
          property_id: 'test',
          result: auditResult,
          final_status: 'WATCHLIST',
          audited_at: '2026-08-09T18:00:00Z',
        };

        const result = validator.validateAudit(audit);
        expect(result.valid, `Result ${auditResult} should be valid`).toBe(true);
      }
    });

    it('validates all finding severities', () => {
      const severities = ['info', 'warning', 'blocking'];

      for (const severity of severities) {
        const audit = {
          property_id: 'test',
          result: 'PASS',
          final_status: 'VIABLE',
          findings: [{ severity, message: 'Test finding' }],
          audited_at: '2026-08-09T18:00:00Z',
        };

        const result = validator.validateAudit(audit);
        expect(result.valid, `Severity ${severity} should be valid`).toBe(true);
      }
    });

    it('rejects audit with invalid result', () => {
      const audit = {
        property_id: 'test',
        result: 'INVALID_RESULT',
        final_status: 'VIABLE',
        audited_at: '2026-08-09T18:00:00Z',
      };

      const result = validator.validateAudit(audit);
      expect(result.valid).toBe(false);
    });
  });

  describe('Example property validation', () => {
    it('validates the _example meta.json file', async () => {
      const { readFileSync } = await import('node:fs');
      const metaPath = resolve(__dirname, '../../../data/properties/_example/meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(true);
    });

    it('validates the _example evidence.json file', async () => {
      const { readFileSync } = await import('node:fs');
      const evidencePath = resolve(__dirname, '../../../data/properties/_example/evidence.json');
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(true);
    });

    it('validates the _example underwriting.json file', async () => {
      const { readFileSync } = await import('node:fs');
      const underwritingPath = resolve(
        __dirname,
        '../../../data/properties/_example/underwriting.json'
      );
      const underwriting = JSON.parse(readFileSync(underwritingPath, 'utf-8'));

      const result = validator.validateUnderwriting(underwriting);
      expect(result.valid).toBe(true);
    });

    it('validates the _example audit.json file', async () => {
      const { readFileSync } = await import('node:fs');
      const auditPath = resolve(__dirname, '../../../data/properties/_example/audit.json');
      const audit = JSON.parse(readFileSync(auditPath, 'utf-8'));

      const result = validator.validateAudit(audit);
      expect(result.valid).toBe(true);
    });
  });

  describe('TASK-010 screened batch property validation', () => {
    it('validates 9860-s-thomas-dr evidence.json', async () => {
      const { readFileSync } = await import('node:fs');
      const evidencePath = resolve(
        __dirname,
        '../../../data/properties/9860-s-thomas-dr-unit-917-panama-city-beach-fl/evidence.json'
      );
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(true);
    });

    it('validates 9860-s-thomas-dr meta.json', async () => {
      const { readFileSync } = await import('node:fs');
      const metaPath = resolve(
        __dirname,
        '../../../data/properties/9860-s-thomas-dr-unit-917-panama-city-beach-fl/meta.json'
      );
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(true);
      expect(meta.workflow_state).toBe('READY_FOR_UNDERWRITING');
    });

    it('validates 225-celebration-pl evidence.json', async () => {
      const { readFileSync } = await import('node:fs');
      const evidencePath = resolve(
        __dirname,
        '../../../data/properties/225-celebration-pl-unit-526-celebration-fl/evidence.json'
      );
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));

      const result = validator.validateEvidence(evidence);
      expect(result.valid).toBe(true);
    });

    it('validates 225-celebration-pl meta.json', async () => {
      const { readFileSync } = await import('node:fs');
      const metaPath = resolve(
        __dirname,
        '../../../data/properties/225-celebration-pl-unit-526-celebration-fl/meta.json'
      );
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

      const result = validator.validateMeta(meta);
      expect(result.valid).toBe(true);
      expect(meta.workflow_state).toBe('READY_FOR_UNDERWRITING');
    });

    it('verifies all TASK-010 properties have required evidence fields', async () => {
      const { readFileSync } = await import('node:fs');
      const propertyIds = [
        '9860-s-thomas-dr-unit-917-panama-city-beach-fl',
        '225-celebration-pl-unit-526-celebration-fl',
      ];

      for (const id of propertyIds) {
        const evidencePath = resolve(__dirname, `../../../data/properties/${id}/evidence.json`);
        const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));

        expect(evidence.property_id, `${id} should have property_id`).toBe(id);
        expect(evidence.researched_at, `${id} should have researched_at`).toBeDefined();
        expect(evidence.purchase_price, `${id} should have purchase_price`).toBeDefined();
        expect(evidence.monthly_rent, `${id} should have monthly_rent`).toBeDefined();
        expect(evidence.hoa_monthly, `${id} should have hoa_monthly`).toBeDefined();
        expect(evidence.special_assessments, `${id} should have special_assessments`).toBeDefined();
        expect(evidence.property_taxes_annual, `${id} should have property_taxes_annual`).toBeDefined();
        expect(evidence.insurance_annual, `${id} should have insurance_annual`).toBeDefined();
        expect(evidence.management_annual, `${id} should have management_annual`).toBeDefined();
        expect(evidence.utilities_annual, `${id} should have utilities_annual`).toBeDefined();
        expect(evidence.other_expenses_annual, `${id} should have other_expenses_annual`).toBeDefined();
        expect(evidence.rental_restrictions, `${id} should have rental_restrictions`).toBeDefined();
        expect(evidence.str_restrictions, `${id} should have str_restrictions`).toBeDefined();
      }
    });
  });
});
