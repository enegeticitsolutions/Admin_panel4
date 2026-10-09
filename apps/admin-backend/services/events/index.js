/**
 * Central Event Dispatcher Registry (`services/events/index.js`)
 *
 * Enterprise modular event layer for MaiHoonNa system.
 * Aggregates all domain event dispatchers into a clean unified module:
 *   - Visit Events (scheduled, rescheduled, cancelled, started, completed)
 *   - Medication Events (reminders, missed doses)
 *   - Emergency Events (SOS triggered, ambulance status, ticket resolved)
 *   - Vitals Events (abnormal BP/SpO2/glucose alerts)
 *   - Roster Events (care team assignments, reallocations, roster approvals)
 */

const visitEvents = require('./visit-event.dispatcher');
const medicationEvents = require('./medication-event.dispatcher');
const emergencyEvents = require('./emergency-event.dispatcher');
const vitalsEvents = require('./vitals-event.dispatcher');
const rosterEvents = require('./roster-event.dispatcher');
const accountEvents = require('./account-event.dispatcher');
const moodEvents = require('./mood-event.dispatcher');
const subscriptionEvents = require('./subscription-event.dispatcher');
const communityEvents = require('./community-event.dispatcher');
const serviceRequestEvents = require('./service-request-event.dispatcher');
const adminEvents = require('./admin-event.dispatcher');
const sathiEvents = require('./sathi-event.dispatcher');

module.exports = {
  visitEvents,
  medicationEvents,
  emergencyEvents,
  vitalsEvents,
  rosterEvents,
  accountEvents,
  moodEvents,
  subscriptionEvents,
  communityEvents,
  serviceRequestEvents,
  adminEvents,
  sathiEvents,

  // Direct helper exports for convenience
  ...visitEvents,
  ...medicationEvents,
  ...emergencyEvents,
  ...vitalsEvents,
  ...rosterEvents,
  ...accountEvents,
  ...moodEvents,
  ...subscriptionEvents,
  ...communityEvents,
  ...serviceRequestEvents,
  ...adminEvents,
  ...sathiEvents,
};
