/**
 * Dashboard Layout - Main layout with sidebar navigation
 */

import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
  MapPin,
  Users,
  Calendar,
  UserCheck,
  UserCircle,
  HeadphonesIcon,
  PhoneCall,
  FileText,
  Handshake,
  Heart,
  Package,
  LogOut,
  Menu,
  Settings,
  Home,
  UserPlus,
  Activity,
  Tag,
  RefreshCw,
  Radio,
  ShieldAlert,
  Clock,
  Crown,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';

interface NavItem {
  path: string;
  label: string;
  icon: any;
  roles: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: Home, roles: [] },
      { path: '/emergency-radar', label: 'Emergency Radar', icon: Radio, roles: [] },
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { path: '/visits', label: 'Visits', icon: Calendar, roles: ['master_admin', 'operations_manager', 'field_manager'] },
      { path: '/requested-visits', label: 'Requested Visits', icon: Clock, roles: ['master_admin', 'operations_manager', 'field_manager'] },
      { path: '/field-management', label: 'Field Management', icon: Activity, roles: ['master_admin', 'operations_manager', 'field_manager'] },

      { path: '/regions', label: 'Regions', icon: MapPin, roles: ['master_admin', 'operations_manager'] },
      { path: '/zones', label: 'Zones', icon: MapPin, roles: ['master_admin', 'operations_manager'] },
      { path: '/teams', label: 'Teams', icon: Users, roles: ['master_admin', 'operations_manager'] },
      { path: '/field-managers', label: 'Field Managers List', icon: Calendar, roles: ['master_admin', 'operations_manager'] },
      { path: '/allocation', label: 'Beneficiary Allocation', icon: Activity, roles: ['master_admin', 'operations_manager'] },
      { path: '/care-companions', label: 'Care Companions', icon: UserCheck, roles: ['master_admin', 'operations_manager'] },
      { path: '/volunteers', label: 'Saathi Volunteers', icon: Handshake, roles: ['master_admin', 'operations_manager'] },
      { path: '/volunteer-requests', label: 'Saathi Onboarding', icon: UserPlus, roles: ['master_admin', 'operations_manager'] },
      { path: '/legacy-circle', label: 'Legacy Circle Approval', icon: Crown, roles: ['master_admin', 'operations_manager'] },
      { path: '/staff-onboarding', label: 'Staff Onboarding', icon: UserPlus, roles: ['master_admin', 'operations_manager'] },
      { path: '/operations-managers', label: 'Operations Managers', icon: Users, roles: ['master_admin'] },
      { path: '/customer-service-agents', label: 'CSA', icon: HeadphonesIcon, roles: ['master_admin', 'operations_manager'] },
    ]
  },
  {
    title: 'CLIENTS',
    items: [
      { path: '/subscribers', label: 'Subscribers', icon: UserCircle, roles: ['master_admin', 'operations_manager'] },
      { path: '/enroll', label: 'Enroll Subscriber', icon: UserPlus, roles: ['master_admin', 'operations_manager'] },
      { path: '/renewals', label: 'Renewals Worklist', icon: RefreshCw, roles: ['master_admin', 'operations_manager', 'customer_service'] },
      { path: '/beneficiaries', label: 'Beneficiaries', icon: Heart, roles: ['master_admin', 'operations_manager'] },
      { path: '/callback-requests', label: 'Callback Requests', icon: PhoneCall, roles: ['master_admin', 'operations_manager', 'customer_service'] },
    ]
  },
  {
    title: 'VITALS',
    items: [
      { path: '/vitals/definitions', label: 'Vital definitions', icon: Activity, roles: ['master_admin'] },
      { path: '/vitals/templates', label: 'Config templates', icon: FileText, roles: ['master_admin'] },
      { path: '/vitals/beneficiary-config', label: 'Beneficiary config', icon: UserCheck, roles: ['master_admin'] },
      { path: '/vitals/capture-log', label: 'Capture log', icon: Activity, roles: ['master_admin'] },
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/website-content', label: 'Website Content', icon: FileText, roles: ['master_admin'] },
      { path: '/config', label: 'System Settings', icon: Settings, roles: ['master_admin'] },
      { path: '/subscriptions', label: 'Subscription Packages', icon: Package, roles: ['master_admin'] },
      { path: '/benefit-types', label: 'Benefit Types', icon: Settings, roles: ['master_admin'] },
      { path: '/benefits', label: 'Benefits Library', icon: FileText, roles: ['master_admin'] },
      { path: '/addons', label: 'Add-ons Management', icon: FileText, roles: ['master_admin'] },
      { path: '/coupons', label: 'Coupons & Promos', icon: Tag, roles: ['master_admin'] },
      { path: '/vitals/alert-rules', label: 'Alert rules', icon: Settings, roles: ['master_admin'] },
      { path: '/admin-users', label: 'Admin Users', icon: Settings, roles: ['master_admin'] },
      { path: '/guide-management', label: 'Guide Management', icon: FileText, roles: ['master_admin'] },
      { path: '/activity-logs', label: 'Activity Logs', icon: FileText, roles: ['master_admin'] },
    ]
  }
];

interface NavContentProps {
  user: any;
  logout: () => void;
  hasAccess: (roles: any[]) => boolean;
  location: any;
  navigate: (path: string) => void;
  handleLogout: () => void;
}

const NavContent = ({ user, logout, hasAccess, location, navigate, handleLogout }: NavContentProps) => (
  <>
    <div className="p-6 border-b border-border">
      <h2 className="text-xl font-semibold text-primary">MaiHoonNa</h2>
      <p className="text-xs text-muted-foreground mt-1">Senior Care Operations</p>
    </div>
    
    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
      {navigationSections.map((section) => {
        const filteredItems = section.items.filter((item) =>
          item.roles.length === 0 || hasAccess(item.roles as any)
        );
        
        if (filteredItems.length === 0) return null;
        
        return (
          <div key={section.title} className="space-y-2">
            <h3 className="px-3 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
              {section.title}
            </h3>
            <nav className="space-y-1">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground/70")} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        );
      })}
    </div>

    <div className="p-4 border-t border-border space-y-3">
      <div className="px-3 py-2 rounded-lg bg-secondary">
        <p className="text-xs text-muted-foreground">Logged in as</p>
        <p className="text-sm font-medium truncate">{user?.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
      </div>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    </div>
  </>
);

export default function DashboardLayout() {
  const { user, logout, hasAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navProps = { user, logout, hasAccess, location, navigate, handleLogout };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-card border-r border-border">
        <NavContent {...navProps} />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-10 flex items-center justify-between px-4">
        <h2 className="text-lg font-semibold text-primary">MaiHoonNa</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-full">
              <NavContent {...navProps} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="pt-16 lg:pt-0 p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
