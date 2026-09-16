/**
 * MaiHoonNa Senior Care Operations Portal - Route Configuration
 * Defines all application routes using React Router Data mode
 */

import { createBrowserRouter, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import ZonesPage from './pages/ZonesPage';
import OperationsManagersPage from './pages/OperationsManagersPage';
import FieldManagementPage from './pages/FieldManagementPage';
import FieldManagerPage from './pages/FieldManagerPage';
import VisitsPage from './pages/VisitsPage';
import CareCompanionsPage from './pages/CareCompanionsPage';
import SubscribersPage from './pages/SubscribersPage';
import BeneficiariesPage from './pages/BeneficiariesPage';
import SupportPage from './pages/SupportPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import PartnersPage from './pages/PartnersPage';
import VolunteersPage from './pages/VolunteersPage';
import VolunteerRequestsPage from './pages/VolunteerRequestsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import CallbacksPage from './pages/CallbacksPage';
import TeamsPage from './pages/TeamsPage';
import CreateTeamPage from './pages/CreateTeamPage';
import EditTeamPage from './pages/EditTeamPage';
import StaffOnboardingPage from './pages/StaffOnboardingPage';
import BenefitTypesPage from './pages/BenefitTypesPage';
import BenefitsPage from './pages/BenefitsPage';
import AddonsPage from './pages/AddonsPage';
import RegionsPage from './pages/RegionsPage';
import ConfigurationPage from './pages/ConfigurationPage';
import WebsiteContentPage from './pages/WebsiteContentPage';

import CouponsPage from './pages/CouponsPage';
import SubscriberProfilePage from './pages/SubscriberProfilePage';
import BeneficiaryProfilePage from './pages/BeneficiaryProfilePage';
import EnrollmentWizardPage from './pages/EnrollmentWizardPage';
import AllocationPage from './pages/AllocationPage';
import CustomerServiceAgentsPage from './pages/CustomerServiceAgentsPage';
import VitalDefinitionsPage from './pages/vitals/VitalDefinitionsPage';
import VitalTemplatesPage from './pages/vitals/VitalTemplatesPage';
import BeneficiaryVitalsPage from './pages/vitals/BeneficiaryVitalsPage';
import VitalsCaptureLogPage from './pages/vitals/VitalsCaptureLogPage';
import AlertRulesPage from './pages/vitals/AlertRulesPage';
import RenewalsWorklistPage from './pages/RenewalsWorklistPage';
import RenewalWizardPage from './pages/RenewalWizardPage';
import GuideManagementPage from './pages/GuideManagementPage';
import EmergencyRadarPage from './pages/EmergencyRadarPage';
import RequestedVisitsPage from './pages/RequestedVisitsPage';
import CheckoutPage from './pages/CheckoutPage';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: LoginPage,
  },
  {
    path: '/pay/:orderId',
    Component: CheckoutPage,
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        path: 'dashboard',
        Component: DashboardPage,
      },
      {
        path: 'zones',
        Component: ZonesPage,
      },
      {
        path: 'callback-requests',
        Component: CallbacksPage,
      },
      {
        path: 'operations-managers',
        Component: OperationsManagersPage,
      },
      {
        path: 'customer-service-agents',
        Component: CustomerServiceAgentsPage,
      },
      {
        path: 'field-management',
        Component: FieldManagementPage,
      },
      {
        path: 'field-managers',
        Component: FieldManagerPage,
      },
      {
        path: 'visits',
        Component: VisitsPage,
      },
      {
        path: 'requested-visits',
        Component: RequestedVisitsPage,
      },
      {
        path: 'visit-requests',
        Component: RequestedVisitsPage,
      },

      {
        path: 'care-companions',
        Component: CareCompanionsPage,
      },
      {
        path: 'subscribers',
        Component: SubscribersPage,
      },
      {
        path: 'subscribers/:id',
        Component: SubscriberProfilePage,
      },
      {
        path: 'beneficiaries',
        Component: BeneficiariesPage,
      },
      {
        path: 'beneficiaries/:id',
        Component: BeneficiaryProfilePage,
      },
      {
        path: 'allocation',
        Component: AllocationPage,
      },
      {
        path: 'support',
        Component: SupportPage,
      },
      {
        path: 'activity-logs',
        Component: ActivityLogsPage,
      },
      {
        path: 'partners',
        Component: PartnersPage,
      },
      {
        path: 'volunteers',
        Component: VolunteersPage,
      },
      {
        path: 'volunteer-requests',
        Component: VolunteerRequestsPage,
      },
      {
        path: 'subscriptions',
        Component: SubscriptionsPage,
      },
      {
        path: 'admin-users',
        Component: AdminUsersPage,
      },
      {
        path: 'guide-management',
        Component: GuideManagementPage,
      },
      {
        path: 'teams',
        Component: TeamsPage,
      },
      {
        path: 'create-team',
        Component: CreateTeamPage,
      },
      {
        path: 'edit-team/:id',
        Component: EditTeamPage,
      },
      {
        path: 'staff-onboarding',
        Component: StaffOnboardingPage,
      },
      {
        path: 'benefit-types',
        Component: BenefitTypesPage,
      },
      {
        path: 'benefits',
        Component: BenefitsPage,
      },
      {
        path: 'addons',
        Component: AddonsPage,
      },
      {
        path: 'vitals',
        element: <Navigate to="/vitals/definitions" replace />,
      },
      {
        path: 'vitals/definitions',
        Component: VitalDefinitionsPage,
      },
      {
        path: 'vitals/templates',
        Component: VitalTemplatesPage,
      },
      {
        path: 'vitals/beneficiary-config',
        Component: BeneficiaryVitalsPage,
      },
      {
        path: 'vitals/capture-log',
        Component: VitalsCaptureLogPage,
      },
      {
        path: 'vitals/alert-rules',
        Component: AlertRulesPage,
      },

      {
        path: 'coupons',
        Component: CouponsPage,
      },
      {
        path: 'enroll',
        Component: EnrollmentWizardPage,
      },
      {
        path: 'renewals',
        Component: RenewalsWorklistPage,
      },
      {
        path: 'renew/:subscriptionId',
        Component: RenewalWizardPage,
      },
      {
        path: 'regions',
        Component: RegionsPage,
      },
      {
        path: 'emergency-radar',
        Component: EmergencyRadarPage,
      },
      {
        path: 'config',
        Component: ConfigurationPage,
      },
      {
        path: 'website-content',
        Component: WebsiteContentPage,
      },
    ],
  },
]);
