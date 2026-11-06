import React, { useState, useEffect } from 'react';
import { communityApi } from '../../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CommunityCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563EB');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await communityApi.getCategories();
      setCategories(res || []);
    } catch (e: any) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      setSaving(true);
      await communityApi.createCategory({ name, description, color });
      toast.success('Category created!');
      setDialogOpen(false);
      setName('');
      setDescription('');
      loadCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Categories</h1>
          <p className="text-sm text-slate-500">
            Organize events, health blogs, and podcasts by wellness domain.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Category
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
                  <TableHead>Category Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Linked Content</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      No categories defined yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-semibold text-slate-900">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{c.slug}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: c.color }} />
                          <span className="text-xs text-slate-600">{c.color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{c.description || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {c._count?.events || 0} Events • {c._count?.blogs || 0} Blogs • {c._count?.podcasts || 0} Shows
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.isActive ? 'default' : 'secondary'}>
                          {c.isActive ? 'Active' : 'Disabled'}
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
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Category Name *</label>
              <Input
                placeholder="e.g. Active Aging, Mental Health, Nutrition"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Badge Color</label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 cursor-pointer p-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Description</label>
              <Input
                placeholder="Brief description of this topic"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#FE6700] text-white">Save Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

