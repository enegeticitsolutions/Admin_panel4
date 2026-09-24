/**
 * MaiHoonNa Admin — Role-Based Access Control (RBAC)
 *
 * Roles (from DB UserRole enum — no new roles added):
 *   master_admin, admin, operations_manager, field_manager,
 *   care_companion (mobile only — no portal),
 *   customer_service_manager, customer_service,
 *   saathi_coordinator, emergency_coordinator, command_center
 *
 * Usage:
 *   const { can, scopeFilter } = require('../utils/rbac');
 *   if (!can(req.user, 'visits.create')) return res.status(403)...
 *   const filter = await scopeFilter(req.user); // zone/team Prisma where clause
 */

const { prisma } = require('../lib/prisma');

// ─── Permission Map ───────────────────────────────────────────────────────────
// true  = always allowed
// false = never allowed (for portal; e.g. care_companion has no portal access)
// 'zone'= allowed but scoped to own zone(s) — enforced in scopeFilter()
// 'team'= allowed but scoped to own team(s)

const PERMISSIONS = {
  // ── Regions ────────────────────────────────────────────────────────────────
  'regions.list':           { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'zone' },
  'regions.create':         { master_admin: true, admin: true },
  'regions.update':         { master_admin: true, admin: true },
  'regions.delete':         { master_admin: true },

  // ── Zones ──────────────────────────────────────────────────────────────────
  'zones.list':             { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'zone' },
  'zones.view':             { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'zone' },
  'zones.create':           { master_admin: true, admin: true },
  'zones.update':           { master_admin: true, admin: true },
  'zones.assign_om':        { master_admin: true, admin: true },
  'zones.toggle_active':    { master_admin: true, admin: true },
  'zones.delete':           { master_admin: true },

  // ── Teams ──────────────────────────────────────────────────────────────────
  'teams.list':             { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'teams.view':             { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'teams.create':           { master_admin: true, admin: true, operations_manager: 'zone' },
  'teams.update':           { master_admin: true, admin: true, operations_manager: 'zone' },
  'teams.onboard_cc':       { master_admin: true, admin: true, operations_manager: 'zone' },
  'teams.onboard_fm':       { master_admin: true, admin: true, operations_manager: 'zone' },
  'teams.available_companions': { master_admin: true, admin: true, operations_manager: 'zone' },
  'teams.available_managers':   { master_admin: true, admin: true, operations_manager: 'zone' },

  // ── Staff ──────────────────────────────────────────────────────────────────
  'staff.list_field_managers':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'self' },
  'staff.list_ops_managers':     { master_admin: true, admin: true },
  'staff.list_care_companions':  { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'staff.list_csa':             { master_admin: true, admin: true, customer_service_manager: true },
  'staff.view':                 { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'staff.onboard':              { master_admin: true, admin: true, operations_manager: 'zone' },
  'staff.create':               { master_admin: true, admin: true },
  'staff.update':               { master_admin: true, admin: true, operations_manager: 'zone' },
  'staff.deactivate':           { master_admin: true, admin: true, operations_manager: 'zone' },

  // ── Field Manager self-context ─────────────────────────────────────────────
  'fm.my_team':           { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'fm.my_team_schedule':  { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'fm.beneficiaries':     { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'fm.benefit_usage':     { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'fm.cc_availability':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },

  // ── Allocation ─────────────────────────────────────────────────────────────
  'allocation.available_staff':   { master_admin: true, admin: true, operations_manager: 'zone' },
  'allocation.assign_to_team':    { master_admin: true, admin: true, operations_manager: 'zone' },
  'allocation.assign_cc':         { master_admin: true, admin: true, operations_manager: 'zone' },
  'allocation.view_unallocated':  { master_admin: true, admin: true, operations_manager: 'zone' },

  // ── Visits ─────────────────────────────────────────────────────────────────
  'visits.list':            { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: 'read', customer_service: 'read', emergency_coordinator: 'read', command_center: 'read' },
  'visits.view':            { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: 'read', customer_service: 'read', emergency_coordinator: 'read', command_center: 'read' },
  'visits.create':          { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' }, // ✅ field_manager confirmed
  'visits.edit':            { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.complete':        { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.cancel_status':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.resolve_change':  { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.delete':          { master_admin: true },
  'visits.upload_evidence': { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.check_availability': { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.service_requests':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: true },
  'visits.roster_approve':     { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.roster_feedback':    { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.roster_view_approvals':  { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visits.roster_view_feedbacks':  { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },

  // ── Visit Requests ─────────────────────────────────────────────────────────
  'visit_requests.list':      { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: true },
  'visit_requests.approve':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visit_requests.reject':    { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'visit_requests.mark_read': { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: true },

  // ── Subscribers ────────────────────────────────────────────────────────────
  'subscribers.list':            { master_admin: true, admin: true, operations_manager: true, field_manager: 'read', customer_service_manager: true, customer_service: true },
  'subscribers.view':            { master_admin: true, admin: true, operations_manager: true, field_manager: 'read', customer_service_manager: true, customer_service: true },
  'subscribers.update_contact':  { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'subscribers.suspend':         { master_admin: true, admin: true },
  'subscribers.delete':          { master_admin: true },

  // ── Beneficiaries ─────────────────────────────────────────────────────────
  'beneficiaries.list':                 { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: 'read' },
  'beneficiaries.view':                 { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: 'read' },
  'beneficiaries.update_profile':       { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: true },
  'beneficiaries.update_medical':       { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true },
  'beneficiaries.add_medication':       { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true },
  'beneficiaries.remove_medication':    { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true },
  'beneficiaries.add_condition':        { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true },
  'beneficiaries.remove_condition':     { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true },
  'beneficiaries.view_service_requests': { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', customer_service_manager: true, customer_service: true },
  'beneficiaries.assign_to_team':       { master_admin: true, admin: true, operations_manager: 'zone' },
  'beneficiaries.assign_cc':            { master_admin: true, admin: true, operations_manager: 'zone' },

  // ── Subscriptions & Enrollment ─────────────────────────────────────────────
  'subscriptions.check_phone':      { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'subscriptions.calculate_price':  { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'subscriptions.enroll':           { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true }, // ✅ CSA confirmed
  'subscriptions.view_balances':    { master_admin: true, admin: true, operations_manager: true, field_manager: 'team', customer_service_manager: true, customer_service: true },
  'subscriptions.init_balances':    { master_admin: true, admin: true },
  'subscriptions.consume_benefit':  { master_admin: true, admin: true, operations_manager: 'zone' },
  'subscriptions.allocate_addon':   { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true },
  'subscriptions.view_utilization': { master_admin: true, admin: true, operations_manager: true, field_manager: 'team', customer_service_manager: true, customer_service: true },
  'subscriptions.view_expiring':    { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'subscriptions.terminate':        { master_admin: true, admin: true },
  'subscriptions.adjust_quota':     { master_admin: true, admin: true, customer_service_manager: true }, // ✅ CSM confirmed
  'subscriptions.view_renewal':     { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'subscriptions.renew':            { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },

  // ── Packages ───────────────────────────────────────────────────────────────
  'packages.list':            { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'packages.view':            { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'packages.create':          { master_admin: true, admin: true },
  'packages.update_meta':     { master_admin: true, admin: true },
  'packages.update_pricing':  { master_admin: true, admin: true },
  'packages.delete':          { master_admin: true },
  'packages.add_benefits':    { master_admin: true, admin: true },

  // ── Benefit Types & Benefits Library ───────────────────────────────────────
  'benefit_types.list':    { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'benefit_types.create':  { master_admin: true, admin: true },
  'benefit_types.update':  { master_admin: true, admin: true },
  'benefit_types.delete':  { master_admin: true },
  'benefits.list':         { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'benefits.view':         { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'benefits.create':       { master_admin: true, admin: true },
  'benefits.update':       { master_admin: true, admin: true },
  'benefits.delete':       { master_admin: true },

  // ── Add-ons ────────────────────────────────────────────────────────────────
  'addons.list':    { master_admin: true, admin: true, operations_manager: true, customer_service_manager: true, customer_service: true },
  'addons.create':  { master_admin: true, admin: true },
  'addons.update':  { master_admin: true, admin: true },
  'addons.delete':  { master_admin: true },

  // ── Coupons ────────────────────────────────────────────────────────────────
  'coupons.list':      { master_admin: true, admin: true, customer_service_manager: true, customer_service: 'read' },
  'coupons.analytics': { master_admin: true, admin: true, customer_service_manager: true },
  'coupons.view':      { master_admin: true, admin: true, customer_service_manager: true, customer_service: 'read' },
  'coupons.create':    { master_admin: true, admin: true },
  'coupons.update':    { master_admin: true, admin: true },
  'coupons.delete':    { master_admin: true },

  // ── Vitals ─────────────────────────────────────────────────────────────────
  'vitals.definitions.list':   { master_admin: true, admin: true, operations_manager: 'read', field_manager: 'read' },
  'vitals.definitions.create': { master_admin: true, admin: true },
  'vitals.definitions.update': { master_admin: true, admin: true },
  'vitals.definitions.delete': { master_admin: true },
  'vitals.templates.list':     { master_admin: true, admin: true },
  'vitals.templates.create':   { master_admin: true, admin: true },
  'vitals.beneficiary_config.list':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'vitals.beneficiary_config.view':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'vitals.beneficiary_config.update': { master_admin: true, admin: true, operations_manager: 'zone' },
  'vitals.readings.list':   { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'vitals.readings.trends': { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team' },
  'vitals.alert_rules.list':   { master_admin: true, admin: true },
  'vitals.alert_rules.create': { master_admin: true, admin: true },
  'vitals.alert_rules.update': { master_admin: true, admin: true },
  'vitals.alert_rules.delete': { master_admin: true },

  // ── Emergency ──────────────────────────────────────────────────────────────
  'emergency.list':          { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'read', emergency_coordinator: true, command_center: true },
  'emergency.update_status': { master_admin: true, admin: true, operations_manager: 'zone', emergency_coordinator: true, command_center: true }, // ✅ command_center confirmed
  'emergency.add_notes':     { master_admin: true, admin: true, operations_manager: 'zone', field_manager: 'team', emergency_coordinator: true, command_center: true },

  // ── Callbacks ──────────────────────────────────────────────────────────────
  'callbacks.list':   { master_admin: true, admin: true, operations_manager: 'read', customer_service_manager: true, customer_service: true },
  'callbacks.create': { master_admin: true, admin: true, customer_service_manager: true, customer_service: true },
  'callbacks.update': { master_admin: true, admin: true, customer_service_manager: true, customer_service: true },

  // ── Volunteers ─────────────────────────────────────────────────────────────
  'volunteers.list':            { master_admin: true, admin: true, operations_manager: 'read', saathi_coordinator: true },
  'volunteers.view':            { master_admin: true, admin: true, operations_manager: 'read', saathi_coordinator: true },
  'volunteers.verify':          { master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.reject':          { master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.toggle_active':   { master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.toggle_website':  { master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.match_candidates':{ master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.assign':          { master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.unassign':        { master_admin: true, admin: true, saathi_coordinator: true },
  'volunteers.delete':          { master_admin: true },

  // ── Legacy Circle ──────────────────────────────────────────────────────────
  'legacy_circle.list':       { master_admin: true, admin: true, operations_manager: 'read', saathi_coordinator: true },
  'legacy_circle.approve':    { master_admin: true, admin: true, saathi_coordinator: true },
  'legacy_circle.deactivate': { master_admin: true, admin: true, saathi_coordinator: true },

  // ── System Config ──────────────────────────────────────────────────────────
  'config.view':   { master_admin: true, admin: true },
  'config.update': { master_admin: true },
  'config.create': { master_admin: true },

  // ── Admin Users ────────────────────────────────────────────────────────────
  'admin_users.list':            { master_admin: true },
  'admin_users.eligible_staff':  { master_admin: true },
  'admin_users.create':          { master_admin: true },
  'admin_users.reset_password':  { master_admin: true },
  'admin_users.toggle_access':   { master_admin: true },

  // ── Website CMS & Guides ───────────────────────────────────────────────────
  'website_content.view':   { master_admin: true, admin: true },
  'website_content.update': { master_admin: true, admin: true },
  'guides.list':   { master_admin: true, admin: true, operations_manager: true, field_manager: true, customer_service_manager: true, customer_service: true },
  'guides.view':   { master_admin: true, admin: true, operations_manager: true, field_manager: true, customer_service_manager: true, customer_service: true },
  'guides.create': { master_admin: true, admin: true },
  'guides.update': { master_admin: true, admin: true },
  'guides.delete': { master_admin: true },

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  'audit_logs.view': { master_admin: true, admin: 'own' },
};

// ─── can(user, permission) ────────────────────────────────────────────────────
/**
 * Check if a user has a given permission (ignoring scope).
 * Returns true / false. Use scopeFilter() for data-level scoping.
 */
function can(user, permission) {
  if (!user) return false;
  const rule = PERMISSIONS[permission];
  if (!rule) return false;
  const roleAccess = rule[user.role];
  // any truthy value means the role has this permission
  return !!roleAccess;
}

// ─── requirePermission(permission) ───────────────────────────────────────────
/**
 * Express middleware factory.
 * Usage: router.post('/', requirePermission('visits.create'), handler)
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!can(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have permission to perform this action. (${permission})`,
      });
    }
    next();
  };
}

// ─── getScopeType(user, permission) ──────────────────────────────────────────
/**
 * Returns the scope type for a user on a given permission:
 * true | 'zone' | 'team' | 'self' | 'read' | 'own' | false
 */
function getScopeType(user, permission) {
  if (!user) return false;
  const rule = PERMISSIONS[permission];
  if (!rule) return false;
  return rule[user.role] || false;
}

// ─── getOmZoneIds(userId) ─────────────────────────────────────────────────────
/**
 * Returns zone IDs where the OM is assigned as operationsManagerId.
 */
async function getOmZoneIds(userId) {
  const zones = await prisma.zone.findMany({
    where: { operationsManagerId: userId, isActive: true },
    select: { id: true },
  });
  return zones.map((z) => z.id);
}

// ─── getFmTeamIds(userId) ─────────────────────────────────────────────────────
/**
 * Returns team IDs managed by a field manager (via their FieldManager profile).
 */
async function getFmTeamIds(userId) {
  const fm = await prisma.fieldManager.findUnique({
    where: { userId },
    select: {
      id: true,
      teams: { select: { id: true } },
    },
  });
  if (!fm) return [];
  return fm.teams.map((t) => t.id);
}

// ─── scopeFilter(user, options?) ─────────────────────────────────────────────
/**
 * Returns a Prisma-compatible WHERE clause fragment based on the user's role.
 *
 * options.permission — the permission being checked, used to derive scope type
 * options.beneficiaryField — field path to beneficiary (default: 'beneficiaryId')
 * options.teamField        — field path to team (default: 'teamId')
 * options.zoneField        — field path to zone (default: 'zoneId')
 *
 * Returns: { filter: {}, zoneIds: [], teamIds: [] }
 *
 * Examples:
 *   const { filter } = await scopeFilter(req.user, { permission: 'visits.list' });
 *   const visits = await prisma.visit.findMany({ where: { ...baseWhere, ...filter } });
 */
async function scopeFilter(user, options = {}) {
  const { permission, teamField = 'teamId', zoneField = 'zoneId' } = options;

  const result = { filter: {}, zoneIds: [], teamIds: [] };

  if (!user) return result;
  if (user.role === 'master_admin' || user.role === 'admin') return result; // no scope restriction

  const scope = permission ? getScopeType(user, permission) : null;

  if (user.role === 'operations_manager') {
    const zoneIds = await getOmZoneIds(user.id);
    result.zoneIds = zoneIds;
    result.filter[zoneField] = { in: zoneIds };
    return result;
  }

  if (user.role === 'field_manager') {
    const teamIds = await getFmTeamIds(user.id);
    result.teamIds = teamIds;
    result.filter[teamField] = { in: teamIds };
    return result;
  }

  // For other roles with explicit permission scope
  // 'read', 'own', 'self' — no row-level filter (all rows visible, just read-only)
  return result;
}

// ─── getBeneficiaryTeamFilter(user) ──────────────────────────────────────────
/**
 * Returns the Prisma WHERE clause to scope beneficiary queries.
 * - ops_manager: beneficiaries whose zone matches (via pincode→zone match or teamId in zone's teams)
 * - field_manager: beneficiaries in their teams
 * - others: no filter
 */
async function getBeneficiaryFilter(user) {
  if (!user) return {};
  if (user.role === 'master_admin' || user.role === 'admin') return {};

  if (user.role === 'operations_manager') {
    const zoneIds = await getOmZoneIds(user.id);
    // Beneficiaries are zone-scoped by their team's zone
    return {
      team: {
        zoneId: { in: zoneIds },
      },
    };
  }

  if (user.role === 'field_manager') {
    const teamIds = await getFmTeamIds(user.id);
    return { teamId: { in: teamIds } };
  }

  return {};
}

// ─── getVisitFilter(user) ────────────────────────────────────────────────────
/**
 * Returns the Prisma WHERE clause to scope visit queries by role.
 * - ops_manager: visits whose CC's team is in their zone
 * - field_manager: visits whose CC's team is in their team list
 */
async function getVisitFilter(user) {
  if (!user) return {};
  if (user.role === 'master_admin' || user.role === 'admin') return {};

  if (user.role === 'operations_manager') {
    const zoneIds = await getOmZoneIds(user.id);
    return {
      careCompanion: {
        team: { zoneId: { in: zoneIds } },
      },
    };
  }

  if (user.role === 'field_manager') {
    const teamIds = await getFmTeamIds(user.id);
    return {
      careCompanion: {
        teamId: { in: teamIds },
      },
    };
  }

  return {};
}

// ─── Portal-accessible roles ───────────────────────────────────────────────────
const PORTAL_ROLES = [
  'master_admin',
  'admin',
  'operations_manager',
  'field_manager',
  'customer_service_manager',
  'customer_service',
  'saathi_coordinator',
  'emergency_coordinator',
  'command_center',
];

function isPortalRole(role) {
  return PORTAL_ROLES.includes(role);
}

module.exports = {
  PERMISSIONS,
  PORTAL_ROLES,
  can,
  requirePermission,
  getScopeType,
  scopeFilter,
  getBeneficiaryFilter,
  getVisitFilter,
  getOmZoneIds,
  getFmTeamIds,
  isPortalRole,
};
