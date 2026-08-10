import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Schema types supported by the validator
 */
export type SchemaType =
  | 'meta'
  | 'evidence'
  | 'underwriting'
  | 'audit'
  | 'opportunity'
  | 'field-value';

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
}

/**
 * Schema validator using Ajv for JSON Schema draft-07
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<SchemaType, ValidateFunction>;
  private schemasDir: string;

  constructor(schemasDir?: string) {
    this.schemasDir = schemasDir || resolve(__dirname, '../../../schemas');
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.validators = new Map();
    this.loadSchemas();
  }

  /**
   * Load all schemas from the schemas directory
   */
  private loadSchemas(): void {
    const schemaFiles: { type: SchemaType; file: string }[] = [
      { type: 'field-value', file: 'field-value.json' },
      { type: 'meta', file: 'property-meta.json' },
      { type: 'evidence', file: 'property-evidence.json' },
      { type: 'underwriting', file: 'property-underwriting.json' },
      { type: 'audit', file: 'property-audit.json' },
      { type: 'opportunity', file: 'property-opportunity.json' },
    ];

    // Load field-value schema first as it's referenced by others
    const fieldValuePath = resolve(this.schemasDir, 'field-value.json');
    const fieldValueSchema = JSON.parse(readFileSync(fieldValuePath, 'utf-8'));
    this.ajv.addSchema(fieldValueSchema, 'field-value.json');
    
    // Compile field-value validator separately
    const fieldValueValidate = this.ajv.compile(fieldValueSchema);
    this.validators.set('field-value', fieldValueValidate);

    // Load remaining schemas (skip field-value as it's already loaded)
    for (const { type, file } of schemaFiles) {
      if (type === 'field-value') continue;
      
      const schemaPath = resolve(this.schemasDir, file);
      try {
        const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
        const validate = this.ajv.compile(schema);
        this.validators.set(type, validate);
      } catch (error) {
        console.error(`Failed to load schema ${file}:`, error);
        throw error;
      }
    }
  }

  /**
   * Validate data against a schema type
   */
  validate(type: SchemaType, data: unknown): ValidationResult {
    const validate = this.validators.get(type);
    if (!validate) {
      throw new Error(`Unknown schema type: ${type}`);
    }

    const valid = validate(data);
    return {
      valid: valid as boolean,
      errors: validate.errors ?? null,
    };
  }

  /**
   * Validate a meta.json file
   */
  validateMeta(data: unknown): ValidationResult {
    return this.validate('meta', data);
  }

  /**
   * Validate an evidence.json file
   */
  validateEvidence(data: unknown): ValidationResult {
    return this.validate('evidence', data);
  }

  /**
   * Validate an underwriting.json file
   */
  validateUnderwriting(data: unknown): ValidationResult {
    return this.validate('underwriting', data);
  }

  /**
   * Validate an audit.json file
   */
  validateAudit(data: unknown): ValidationResult {
    return this.validate('audit', data);
  }

  /**
   * Validate a PropertyOpportunity object
   */
  validateOpportunity(data: unknown): ValidationResult {
    return this.validate('opportunity', data);
  }

  /**
   * Validate a FieldValue object
   */
  validateFieldValue(data: unknown): ValidationResult {
    return this.validate('field-value', data);
  }

  /**
   * Get the schemas directory path
   */
  getSchemasDir(): string {
    return this.schemasDir;
  }
}

// Export a singleton instance for convenience
let _validator: SchemaValidator | null = null;

export function getValidator(schemasDir?: string): SchemaValidator {
  if (!_validator || schemasDir) {
    _validator = new SchemaValidator(schemasDir);
  }
  return _validator;
}
