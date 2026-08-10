// Types
export type {
  FieldValue,
  WorkflowState,
  ScoutDecision,
  PropertyStatus,
  AuditResult,
  FindingSeverity,
  PropertyMeta,
  PropertyEvidence,
  InputSummary,
  PropertyUnderwriting,
  AuditFinding,
  PropertyAudit,
  Source,
  PropertyOpportunity,
  PropertyRecord,
} from './types.js';

// Validator
export {
  SchemaValidator,
  getValidator,
  type SchemaType,
  type ValidationResult,
} from './validator.js';

// Property Record Manager
export {
  PropertyRecordManager,
  getPropertyManager,
  type CreatePropertyOptions,
} from './property-record.js';
