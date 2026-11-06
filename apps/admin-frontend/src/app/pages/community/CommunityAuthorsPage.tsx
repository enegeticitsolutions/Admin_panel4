import React, { useState, useEffect } from 'react';
import { communityApi } from '../../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CommunityAuthorsPage() {
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadAuthors();
  }, []);

  const loadAuthors = async () => {
    try {
      setLoading(true);
      const res = await communityApi.getAuthors();
      setAuthors(res || []);
    } catch (e: any) {
      toast.error('Failed to load authors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      setSaving(true);
      await communityApi.createAuthor({ name, designation, bio, email });
      toast.success('Author profile created!');
      setDialogOpen(false);
      setName('');
      setDesignation('');
      setBio('');
      setEmail('');
      loadAuthors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create author');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Authors & Event Speakers</h1>
          <p className="text-sm text-slate-500">
            Manage profiles for geriatricians, physiotherapists, yoga teachers, and host speakers.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Author / Speaker
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Speaker / Author</TableHead>
                  <TableHead>Designation & Qualifications</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bio</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      No authors registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  authors.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-semibold text-slate-900">{a.name}</TableCell>
                      <TableCell className="text-sm text-slate-600">{a.designation || 'Specialist'}</TableCell>
                      <TableCell className="text-xs text-slate-500">{a.email || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-600 line-clamp-1 max-w-xs">{a.bio || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={a.isActive ? 'default' : 'secondary'}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Author / Speaker</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <Input
                placeholder="e.g. Dr. Ramesh Gupta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Designation / Degree</label>
              <Input
                placeholder="e.g. MD Geriatric Medicine, Senior Consultant"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <Input
                type="email"
                placeholder="dr.ramesh@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Short Bio</label>
              <Textarea
                placeholder="Expertise, years of experience, and clinical interests..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#FE6700] text-white">Save Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

