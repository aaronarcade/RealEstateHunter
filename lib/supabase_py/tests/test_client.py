"""
Tests for Supabase client factory
"""

import os
import pytest
from unittest.mock import patch

from lib.supabase_py.client import validate_config


class TestValidateConfig:
    def test_returns_valid_when_all_vars_set(self):
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://test.supabase.co",
                "SUPABASE_ANON_KEY": "test-key",
            },
        ):
            valid, errors = validate_config()

            assert valid is True
            assert len(errors) == 0

    def test_reports_missing_url(self):
        with patch.dict(
            os.environ,
            {"SUPABASE_ANON_KEY": "test-key"},
            clear=True,
        ):
            valid, errors = validate_config()

            assert valid is False
            assert "Missing SUPABASE_URL environment variable" in errors

    def test_reports_missing_key(self):
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://test.supabase.co"},
            clear=True,
        ):
            valid, errors = validate_config()

            assert valid is False
            assert "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY" in errors

    def test_accepts_service_role_key(self):
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://test.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "service-key",
            },
        ):
            valid, errors = validate_config()

            assert valid is True
