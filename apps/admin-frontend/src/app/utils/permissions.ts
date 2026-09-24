/**
 * MaiHoonNa Admin — Frontend Permission Map
 *
 * Client-side mirror of the backend rbac.js PERMISSIONS map.
 * Used for UI gating (show/hide buttons, nav items, pages).
 * Real security enforcement is ALWAYS on the backend.
 *
 * Only uses existing DB UserRole enum values.
 */

import type { UserRole } from '../../types';

/**
 * Maps a permission key → array of roles that have this permission.
 * master_admin is always granted implicitly in `can()` — no need to list it here.
 */
export const FRONTEND_PERMISSIONS: Record<string, UserRole[]> = {
  // Regions
  'regions.list':   ['admin', 'operations_manager', 'field_manager'],
  'regions.create': ['admin'],
  'regions.update': ['admin'],
  'regions.delete': [], // master_admin only

  // Zones
  'zones.list':          ['admin', 'operations_manager', 'field_manager'],
  'zones.view':          ['admin', 'operations_manager', 'field_manager'],
  'zones.create':        ['admin'],
  'zones.update':        ['admin'],
  'zones.assign_om':     ['admin'],
  'zones.toggle_active': ['admin'],
  'zones.delete':        [], // master_admin only

  // Teams
  'teams.list':    ['admin', 'operations_manager', 'field_manager'],
  'teams.view':    ['admin', 'operations_manager', 'field_manager'],
  'teams.create':  ['admin', 'operations_manager'],
  'teams.update':  ['admin', 'operations_manager'],
  'teams.onboard_cc': ['admin', 'operations_manager'],
  'teams.onboard_fm': ['admin', 'operations_manager'],

  // Staff
  'staff.list_field_managers':  ['admin', 'operations_manager', 'field_manager'],
  'staff.list_ops_managers':    ['admin'],
  'staff.list_care_companions': ['admin', 'operations_manager', 'field_manager'],
  'staff.list_csa':             ['admin', 'customer_service_manager'],
  'staff.view':                 ['admin', 'operations_manager', 'field_manager'],
  'staff.onboard':              ['admin', 'operations_manager'],
  'staff.create':               ['admin'],
  'staff.update':               ['admin', 'operations_manager'],
  'staff.deactivate':           ['admin', 'operations_manager'],

  // Field Manager self-context
  'fm.my_team':          ['admin', 'operations_manager', 'field_manager'],
  'fm.my_team_schedule': ['admin', 'operations_manager', 'field_manager'],
  'fm.beneficiaries':    ['admin', 'operations_manager', 'field_manager'],
  'fm.benefit_usage':    ['admin', 'operations_manager', 'field_manager'],
  'fm.cc_availability':  ['admin', 'operations_manager', 'field_manager'],

  // Allocation
  'allocation.available_staff':  ['admin', 'operations_manager'],
  'allocation.assign_to_team':   ['admin', 'operations_manager'],
  'allocation.assign_cc':        ['admin', 'operations_manager'],
  'allocation.view_unallocated': ['admin', 'operations_manager'],

  // Visits
  'visits.list':            ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service', 'emergency_coordinator', 'command_center'],
  'visits.view':            ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service', 'emergency_coordinator', 'command_center'],
  'visits.create':          ['admin', 'operations_manager', 'field_manager'], // ✅ FM confirmed
  'visits.edit':            ['admin', 'operations_manager', 'field_manager'],
  'visits.complete':        ['admin', 'operations_manager', 'field_manager'],
  'visits.cancel_status':   ['admin', 'operations_manager', 'field_manager'],
  'visits.resolve_change':  ['admin', 'operations_manager', 'field_manager'],
  'visits.delete':          [], // master_admin only
  'visits.upload_evidence': ['admin', 'operations_manager', 'field_manager'],
  'visits.check_availability': ['admin', 'operations_manager', 'field_manager'],
  'visits.service_requests':   ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'visits.roster_approve':     ['admin', 'operations_manager', 'field_manager'],
  'visits.roster_feedback':    ['admin', 'operations_manager', 'field_manager'],

  // Visit requests
  'visit_requests.list':    ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'visit_requests.approve': ['admin', 'operations_manager', 'field_manager'],
  'visit_requests.reject':  ['admin', 'operations_manager', 'field_manager'],

  // Subscribers
  'subscribers.list':           ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'subscribers.view':           ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'subscribers.update_contact': ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'subscribers.suspend':        ['admin'],
  'subscribers.delete':         [], // master_admin only

  // Beneficiaries
  'beneficiaries.list':                 ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'beneficiaries.view':                 ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'beneficiaries.update_profile':       ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'beneficiaries.update_medical':       ['admin', 'operations_manager', 'field_manager', 'customer_service_manager'],
  'beneficiaries.add_medication':       ['admin', 'operations_manager', 'field_manager', 'customer_service_manager'],
  'beneficiaries.remove_medication':    ['admin', 'operations_manager', 'field_manager', 'customer_service_manager'],
  'beneficiaries.add_condition':        ['admin', 'operations_manager', 'field_manager', 'customer_service_manager'],
  'beneficiaries.remove_condition':     ['admin', 'operations_manager', 'field_manager', 'customer_service_manager'],
  'beneficiaries.view_service_requests':['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'beneficiaries.assign_to_team':       ['admin', 'operations_manager'],
  'beneficiaries.assign_cc':            ['admin', 'operations_manager'],

  // Subscriptions
  'subscriptions.check_phone':      ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'subscriptions.calculate_price':  ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'subscriptions.enroll':           ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'], // ✅ CSA confirmed
  'subscriptions.view_balances':    ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'subscriptions.init_balances':    ['admin'],
  'subscriptions.consume_benefit':  ['admin', 'operations_manager'],
  'subscriptions.allocate_addon':   ['admin', 'operations_manager', 'customer_service_manager'],
  'subscriptions.view_utilization': ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'subscriptions.view_expiring':    ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'subscriptions.terminate':        ['admin'],
  'subscriptions.adjust_quota':     ['admin', 'customer_service_manager'], // ✅ CSM confirmed
  'subscriptions.view_renewal':     ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'subscriptions.renew':            ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],

  // Packages
  'packages.list':           ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'packages.view':           ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'packages.create':         ['admin'],
  'packages.update_meta':    ['admin'],
  'packages.update_pricing': ['admin'],
  'packages.delete':         [], // master_admin only
  'packages.add_benefits':   ['admin'],

  // Benefit Types & Benefits
  'benefit_types.list':   ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'benefit_types.create': ['admin'],
  'benefit_types.update': ['admin'],
  'benefit_types.delete': [], // master_admin only
  'benefits.list':        ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'benefits.view':        ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'benefits.create':      ['admin'],
  'benefits.update':      ['admin'],
  'benefits.delete':      [], // master_admin only

  // Add-ons
  'addons.list':   ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'addons.create': ['admin'],
  'addons.update': ['admin'],
  'addons.delete': [], // master_admin only

  // Coupons
  'coupons.list':      ['admin', 'customer_service_manager', 'customer_service'],
  'coupons.analytics': ['admin', 'customer_service_manager'],
  'coupons.view':      ['admin', 'customer_service_manager', 'customer_service'],
  'coupons.create':    ['admin'],
  'coupons.update':    ['admin'],
  'coupons.delete':    [], // master_admin only

  // Vitals
  'vitals.definitions.list':           ['admin', 'operations_manager', 'field_manager'],
  'vitals.definitions.create':         ['admin'],
  'vitals.definitions.update':         ['admin'],
  'vitals.definitions.delete':         [], // master_admin only
  'vitals.templates.list':             ['admin'],
  'vitals.templates.create':           ['admin'],
  'vitals.beneficiary_config.list':    ['admin', 'operations_manager', 'field_manager'],
  'vitals.beneficiary_config.view':    ['admin', 'operations_manager', 'field_manager'],
  'vitals.beneficiary_config.update':  ['admin', 'operations_manager'],
  'vitals.readings.list':              ['admin', 'operations_manager', 'field_manager'],
  'vitals.readings.trends':            ['admin', 'operations_manager', 'field_manager'],
  'vitals.alert_rules.list':           ['admin'],
  'vitals.alert_rules.create':         ['admin'],
  'vitals.alert_rules.update':         ['admin'],
  'vitals.alert_rules.delete':         [], // master_admin only

  // Emergency
  'emergency.list':          ['admin', 'operations_manager', 'field_manager', 'emergency_coordinator', 'command_center'],
  'emergency.update_status': ['admin', 'operations_manager', 'emergency_coordinator', 'command_center'], // ✅ command_center confirmed
  'emergency.add_notes':     ['admin', 'operations_manager', 'field_manager', 'emergency_coordinator', 'command_center'],

  // Callbacks
  'callbacks.list':   ['admin', 'operations_manager', 'customer_service_manager', 'customer_service'],
  'callbacks.create': ['admin', 'customer_service_manager', 'customer_service'],
  'callbacks.update': ['admin', 'customer_service_manager', 'customer_service'],

  // Volunteers
  'volunteers.list':             ['admin', 'operations_manager', 'saathi_coordinator'],
  'volunteers.view':             ['admin', 'operations_manager', 'saathi_coordinator'],
  'volunteers.verify':           ['admin', 'saathi_coordinator'],
  'volunteers.reject':           ['admin', 'saathi_coordinator'],
  'volunteers.toggle_active':    ['admin', 'saathi_coordinator'],
  'volunteers.toggle_website':   ['admin', 'saathi_coordinator'],
  'volunteers.match_candidates': ['admin', 'saathi_coordinator'],
  'volunteers.assign':           ['admin', 'saathi_coordinator'],
  'volunteers.unassign':         ['admin', 'saathi_coordinator'],
  'volunteers.delete':           [], // master_admin only

  // Legacy Circle
  'legacy_circle.list':       ['admin', 'operations_manager', 'saathi_coordinator'],
  'legacy_circle.approve':    ['admin', 'saathi_coordinator'],
  'legacy_circle.deactivate': ['admin', 'saathi_coordinator'],

  // Config
  'config.view':   ['admin'],
  'config.update': [], // master_admin only
  'config.create': [], // master_admin only

  // Admin Users
  'admin_users.list':           [], // master_admin only
  'admin_users.create':         [], // master_admin only
  'admin_users.reset_password': [], // master_admin only
  'admin_users.toggle_access':  [], // master_admin only

  // Website CMS & Guides
  'website_content.view':   ['admin'],
  'website_content.update': ['admin'],
  'guides.list':    ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'guides.view':    ['admin', 'operations_manager', 'field_manager', 'customer_service_manager', 'customer_service'],
  'guides.create':  ['admin'],
  'guides.update':  ['admin'],
  'guides.delete':  [], // master_admin only

  // Audit Logs
  'audit_logs.view': ['admin'],
};
