/**
 * Tests for Supabase client factory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateConfig } from '../src/client.js';

describe('validateConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return valid when all vars are set', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';

    const result = validateConfig();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing URL', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = 'test-key';

    const result = validateConfig();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing SUPABASE_URL or VITE_SUPABASE_URL');
  });

  it('should report missing key', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;

    const result = validateConfig();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  });

  it('should accept VITE_ prefixed vars', () => {
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

    const result = validateConfig();

    expect(result.valid).toBe(true);
  });
});
