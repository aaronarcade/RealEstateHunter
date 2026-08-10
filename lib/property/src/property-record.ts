import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemaValidator, getValidator, type ValidationResult } from './validator.js';
import type {
  PropertyMeta,
  PropertyEvidence,
  PropertyUnderwriting,
  PropertyAudit,
  PropertyRecord,
  WorkflowState,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Options for creating a property record
 */
export interface CreatePropertyOptions {
  id: string;
  address: string;
  location?: string;
  listing_url: string;
  workflow_state?: WorkflowState;
}

/**
 * Property record manager for CRUD operations
 */
export class PropertyRecordManager {
  private dataDir: string;
  private validator: SchemaValidator;

  constructor(dataDir?: string, schemasDir?: string) {
    this.dataDir = dataDir || resolve(__dirname, '../../../data/properties');
    this.validator = getValidator(schemasDir);
  }

  /**
   * Generate a slug ID from an address
   */
  static generateId(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  /**
   * Get the directory path for a property
   */
  getPropertyDir(id: string): string {
    return join(this.dataDir, id);
  }

  /**
   * Check if a property exists
   */
  exists(id: string): boolean {
    const dir = this.getPropertyDir(id);
    return existsSync(dir) && existsSync(join(dir, 'meta.json'));
  }

  /**
   * List all property IDs
   */
  listProperties(): string[] {
    if (!existsSync(this.dataDir)) {
      return [];
    }

    return readdirSync(this.dataDir, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        if (entry.name.startsWith('.')) return false;
        const metaPath = join(this.dataDir, entry.name, 'meta.json');
        return existsSync(metaPath);
      })
      .map((entry) => entry.name);
  }

  /**
   * Create a new property record
   */
  create(options: CreatePropertyOptions): PropertyMeta {
    const { id, address, location, listing_url, workflow_state = 'CANDIDATE' } = options;

    if (this.exists(id)) {
      throw new Error(`Property ${id} already exists`);
    }

    const now = new Date().toISOString();
    const meta: PropertyMeta = {
      id,
      address,
      ...(location && { location }),
      listing_url,
      workflow_state,
      created_at: now,
      updated_at: now,
    };

    const validation = this.validator.validateMeta(meta);
    if (!validation.valid) {
      throw new Error(`Invalid meta data: ${JSON.stringify(validation.errors)}`);
    }

    const dir = this.getPropertyDir(id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

    return meta;
  }

  /**
   * Read a property meta file
   */
  readMeta(id: string): PropertyMeta {
    const metaPath = join(this.getPropertyDir(id), 'meta.json');
    if (!existsSync(metaPath)) {
      throw new Error(`Property ${id} not found`);
    }
    return JSON.parse(readFileSync(metaPath, 'utf-8'));
  }

  /**
   * Read a property evidence file
   */
  readEvidence(id: string): PropertyEvidence | null {
    const path = join(this.getPropertyDir(id), 'evidence.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  /**
   * Read a property underwriting file
   */
  readUnderwriting(id: string): PropertyUnderwriting | null {
    const path = join(this.getPropertyDir(id), 'underwriting.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  /**
   * Read a property audit file
   */
  readAudit(id: string): PropertyAudit | null {
    const path = join(this.getPropertyDir(id), 'audit.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  /**
   * Read a complete property record
   */
  read(id: string): PropertyRecord {
    return {
      meta: this.readMeta(id),
      evidence: this.readEvidence(id) ?? undefined,
      underwriting: this.readUnderwriting(id) ?? undefined,
      audit: this.readAudit(id) ?? undefined,
    };
  }

  /**
   * Update the meta file
   */
  updateMeta(id: string, updates: Partial<PropertyMeta>): PropertyMeta {
    const current = this.readMeta(id);
    const updated: PropertyMeta = {
      ...current,
      ...updates,
      id: current.id, // ID cannot be changed
      created_at: current.created_at, // Created timestamp cannot be changed
      updated_at: new Date().toISOString(),
    };

    const validation = this.validator.validateMeta(updated);
    if (!validation.valid) {
      throw new Error(`Invalid meta data: ${JSON.stringify(validation.errors)}`);
    }

    const metaPath = join(this.getPropertyDir(id), 'meta.json');
    writeFileSync(metaPath, JSON.stringify(updated, null, 2) + '\n');
    return updated;
  }

  /**
   * Write or update the evidence file
   */
  writeEvidence(id: string, evidence: PropertyEvidence): ValidationResult {
    if (!this.exists(id)) {
      throw new Error(`Property ${id} not found`);
    }

    const validation = this.validator.validateEvidence(evidence);
    if (!validation.valid) {
      return validation;
    }

    const path = join(this.getPropertyDir(id), 'evidence.json');
    writeFileSync(path, JSON.stringify(evidence, null, 2) + '\n');
    return validation;
  }

  /**
   * Write or update the underwriting file
   */
  writeUnderwriting(id: string, underwriting: PropertyUnderwriting): ValidationResult {
    if (!this.exists(id)) {
      throw new Error(`Property ${id} not found`);
    }

    const validation = this.validator.validateUnderwriting(underwriting);
    if (!validation.valid) {
      return validation;
    }

    const path = join(this.getPropertyDir(id), 'underwriting.json');
    writeFileSync(path, JSON.stringify(underwriting, null, 2) + '\n');
    return validation;
  }

  /**
   * Write or update the audit file
   */
  writeAudit(id: string, audit: PropertyAudit): ValidationResult {
    if (!this.exists(id)) {
      throw new Error(`Property ${id} not found`);
    }

    const validation = this.validator.validateAudit(audit);
    if (!validation.valid) {
      return validation;
    }

    const path = join(this.getPropertyDir(id), 'audit.json');
    writeFileSync(path, JSON.stringify(audit, null, 2) + '\n');
    return validation;
  }

  /**
   * Update workflow state with proper state machine validation
   */
  transitionState(id: string, newState: WorkflowState): PropertyMeta {
    const meta = this.readMeta(id);
    const currentState = meta.workflow_state;

    const validTransitions: Record<WorkflowState, WorkflowState[]> = {
      CANDIDATE: ['SCREENED'],
      SCREENED: ['RESEARCHING'],
      RESEARCHING: ['READY_FOR_UNDERWRITING'],
      READY_FOR_UNDERWRITING: ['UNDERWRITTEN'],
      UNDERWRITTEN: ['AUDIT'],
      AUDIT: ['RANKED', 'RESEARCHING'], // NEEDS_RESEARCH routes back
      RANKED: ['PUBLISHED'],
      PUBLISHED: [],
    };

    const allowed = validTransitions[currentState];
    if (!allowed.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${newState}. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none'}`
      );
    }

    return this.updateMeta(id, { workflow_state: newState });
  }

  /**
   * Get all properties in a specific workflow state
   */
  getByState(state: WorkflowState): string[] {
    return this.listProperties().filter((id) => {
      try {
        const meta = this.readMeta(id);
        return meta.workflow_state === state;
      } catch {
        return false;
      }
    });
  }

  /**
   * Validate all files for a property
   */
  validateProperty(id: string): {
    meta: ValidationResult;
    evidence: ValidationResult | null;
    underwriting: ValidationResult | null;
    audit: ValidationResult | null;
    allValid: boolean;
  } {
    const results = {
      meta: this.validator.validateMeta(this.readMeta(id)),
      evidence: null as ValidationResult | null,
      underwriting: null as ValidationResult | null,
      audit: null as ValidationResult | null,
      allValid: true,
    };

    const evidence = this.readEvidence(id);
    if (evidence) {
      results.evidence = this.validator.validateEvidence(evidence);
      if (!results.evidence.valid) results.allValid = false;
    }

    const underwriting = this.readUnderwriting(id);
    if (underwriting) {
      results.underwriting = this.validator.validateUnderwriting(underwriting);
      if (!results.underwriting.valid) results.allValid = false;
    }

    const audit = this.readAudit(id);
    if (audit) {
      results.audit = this.validator.validateAudit(audit);
      if (!results.audit.valid) results.allValid = false;
    }

    if (!results.meta.valid) results.allValid = false;

    return results;
  }
}

// Export a singleton instance for convenience
let _manager: PropertyRecordManager | null = null;

export function getPropertyManager(
  dataDir?: string,
  schemasDir?: string
): PropertyRecordManager {
  if (!_manager || dataDir || schemasDir) {
    _manager = new PropertyRecordManager(dataDir, schemasDir);
  }
  return _manager;
}
