import React, { useEffect, useState } from 'react';
import { 
  Button, 
} from '../components/ui/button';
import { 
  Input, 
} from '../components/ui/input';
import { 
  Select, 
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { 
  Badge, 
} from '../components/ui/badge';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { 
  Plus, 
  Fingerprint, 
  Key, 
  ShieldAlert, 
  ShieldCheck, 
  UserPlus, 
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusChip } from '../components/common/StatusChip';
import { PageHeader } from '../components/common/PageHeader';
import { Label } from '../components/ui/label';
import { adminUserApi } from '../../services/api';
import type { User, UserRole } from '../../types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [eligibleStaff, setEligibleStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    role: '' as UserRole | '',
    password: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const adminRoles = [
    { value: 'admin', label: 'Admin' },
    { value: 'operations_manager', label: 'Operation Manager' },
    { value: 'field_manager', label: 'Field Manager' },
    { value: 'care_companion', label: 'Care-Companion' },
    { value: 'customer_service_manager', label: 'Customer Service Manager' },
    { value: 'customer_service', label: 'Customer Service Agent' },
    { value: 'saathi_coordinator', label: 'Saathi Coordinator' },
    { value: 'command_center', label: 'Command Center Team' },
  ];

  useEffect(() => {
    loadData();
    loadEligibleStaff();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await adminUserApi.getAll();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleStaff = async () => {
    try {
      const data = await adminUserApi.getEligibleStaff();
      setEligibleStaff(data);
    } catch (error) {
      console.error('Failed to load eligible staff', error);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.userId || !formData.role || !formData.password) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await adminUserApi.create({
        userId: formData.userId,
        role: formData.role as string,
        password: formData.password
      });
      toast.success('Admin access granted successfully');
      setShowCreateModal(false);
      setFormData({ userId: '', role: '', password: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin user');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    try {
      await adminUserApi.resetPassword(selectedUser.id, newPassword);
      toast.success('Password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await adminUserApi.toggleStatus(user.id, !user.isActive);
      toast.success(`Access ${!user.isActive ? 'opened' : 'closed'} successfully`);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'master_admin': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'admin': return 'bg-red-100 text-red-700 border-red-200';
      case 'operations_manager': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'field_manager': return 'bg-green-100 text-green-700 border-green-200';
      case 'care_companion': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'customer_service_manager': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'customer_service': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'saathi_coordinator': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'command_center': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'volunteer': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone.includes(searchQuery) ||
    user.role.replace('_', ' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin User Management"
        description="Configure login access and roles for verified staff members"
        action={
          <Button className="bg-primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Enable Admin Access
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Admin Users</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Active Sessions</p>
          <p className="text-2xl font-bold text-success-foreground">{users.filter(u => u.isActive).length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Eligible Staff</p>
          <p className="text-2xl font-bold text-primary">{eligibleStaff.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Role Types</p>
          <p className="text-2xl font-bold">8</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, phone or role..." 
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Access Status</th>
                <th className="px-6 py-3">Last Active</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {user.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${getRoleBadgeColor(user.role)}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusChip status={user.isActive ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordModal(true);
                          }}>
                            <Key className="w-4 h-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className={user.isActive ? "text-destructive" : "text-success-foreground"}
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.isActive ? (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                Close Access
                              </>
                            ) : (
                              <>
                                <Unlock className="w-4 h-4 mr-2" />
                                Open Access
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Enable Admin Access</DialogTitle>
            <DialogDescription>
              Grant administrative access to verified staff members.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staff">Select Verified Staff</Label>
              <Select 
                onValueChange={(val) => setFormData({ ...formData, userId: val })}
                value={formData.userId}
              >
                <SelectTrigger id="staff">
                  <SelectValue placeholder="Choose staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground">{s.phone} • {s.currentRole.replace('_', ' ')}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {eligibleStaff.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      No eligible staff found. Ensure BGV is verified.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Assign Portal Role</Label>
              <Select 
                onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}
                value={formData.role}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {adminRoles.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Initial Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Provide this password to the employee for their first login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateUser}>Grant Access</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                type="password" 
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button onClick={handleResetPassword}>Save Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
