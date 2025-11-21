"""
Plan utilities for feature gating and plan checking.
"""
from typing import Dict, Any, Optional, Tuple
from mongo_client import mongo_client
from datetime import datetime, timedelta


# Plan features mapping
PLAN_FEATURES = {
    'starter': {
        'max_scans_per_month': 500,
        'pii_types': ['basic'],  # 13 Indian government types
        'api_access': False,
        'batch_processing': False,
        'custom_pii_patterns': False,
        'team_members': 1,
        'masking_options': ['blur'],
        'password_protected_exports': False,
        'priority_support': False,
        'file_formats': ['pdf', 'docx', 'txt', 'csv']
    },
    'professional': {
        'max_scans_per_month': 10000,
        'pii_types': ['all'],  # 36+ types including custom
        'api_access': True,
        'batch_processing': True,
        'custom_pii_patterns': True,
        'team_members': 15,
        'masking_options': ['blur', 'hash'],
        'password_protected_exports': True,
        'priority_support': True,
        'file_formats': ['pdf', 'docx', 'doc', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'svg']
    },
    'enterprise': {
        'max_scans_per_month': -1,  # Unlimited
        'pii_types': ['all'],
        'api_access': True,
        'batch_processing': True,
        'custom_pii_patterns': True,
        'team_members': -1,  # Unlimited
        'masking_options': ['blur', 'hash', 'custom'],
        'password_protected_exports': True,
        'priority_support': True,
        'file_formats': ['all'],
        'sso_integration': True,
        'on_premise': True,
        'dedicated_support': True
    }
}


def get_user_plan(email: str) -> Dict[str, Any]:
    """Get user's current plan."""
    subscription = mongo_client.get_user_subscription(email)
    if not subscription:
        # Default to Starter plan
        return {
            'plan_name': 'Starter',
            'plan_type': 'starter',
            'status': 'active'
        }
    
    return subscription


def get_plan_features(plan_type: str) -> Dict[str, Any]:
    """Get features for a plan type."""
    plan_type_lower = plan_type.lower()
    return PLAN_FEATURES.get(plan_type_lower, PLAN_FEATURES['starter'])


def check_feature_access(email: str, feature: str) -> bool:
    """Check if user has access to a specific feature."""
    subscription = get_user_plan(email)
    plan_type = subscription.get('plan_type', 'starter')
    features = get_plan_features(plan_type)
    
    # Check if subscription is active
    if not mongo_client.check_subscription_active(email):
        # If subscription expired, downgrade to Starter
        plan_type = 'starter'
        features = PLAN_FEATURES['starter']
    
    return features.get(feature, False)


def check_scan_limit(email: str, current_month_scans: int = 0) -> Tuple[bool, Optional[str]]:
    """Check if user can perform more scans this month."""
    subscription = get_user_plan(email)
    plan_type = subscription.get('plan_type', 'starter')
    features = get_plan_features(plan_type)
    
    # Check if subscription is active
    if not mongo_client.check_subscription_active(email):
        plan_type = 'starter'
        features = PLAN_FEATURES['starter']
    
    max_scans = features.get('max_scans_per_month', 500)
    
    # Unlimited scans
    if max_scans == -1:
        return True, None
    
    if current_month_scans >= max_scans:
        return False, f'Monthly scan limit ({max_scans}) reached. Please upgrade your plan.'
    
    return True, None


def can_use_api(email: str) -> bool:
    """Check if user can use API."""
    return check_feature_access(email, 'api_access')


def can_use_batch_processing(email: str) -> bool:
    """Check if user can use batch processing."""
    return check_feature_access(email, 'batch_processing')


def can_use_custom_pii_patterns(email: str) -> bool:
    """Check if user can use custom PII patterns."""
    return check_feature_access(email, 'custom_pii_patterns')


def can_use_hash_masking(email: str) -> bool:
    """Check if user can use hash masking."""
    masking_options = get_plan_features(get_user_plan(email).get('plan_type', 'starter')).get('masking_options', [])
    return 'hash' in masking_options


def can_export_password_protected(email: str) -> bool:
    """Check if user can export password-protected files."""
    return check_feature_access(email, 'password_protected_exports')


def get_allowed_file_formats(email: str) -> list:
    """Get allowed file formats for user's plan."""
    subscription = get_user_plan(email)
    plan_type = subscription.get('plan_type', 'starter')
    features = get_plan_features(plan_type)
    formats = features.get('file_formats', ['pdf', 'docx', 'txt', 'csv'])
    
    if 'all' in formats:
        return ['pdf', 'docx', 'doc', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'svg', 'json']
    
    return formats

