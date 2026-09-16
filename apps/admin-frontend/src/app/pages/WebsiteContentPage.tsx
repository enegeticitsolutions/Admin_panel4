import React, { useState, useEffect } from 'react';
import { apiJson } from '../../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function WebsiteContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testimonials, setTestimonials] = useState<any[]>([]);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const data = await apiJson<any>('/website-content/home');
      setTestimonials(data?.testimonials || []);
    } catch (error) {
      console.error('Error fetching website content:', error);
      toast.error('Failed to load website content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiJson('/website-content/home/testimonials', {
        method: 'PUT',
        body: JSON.stringify({ testimonials }),
      });
      toast.success('Testimonials updated successfully');
    } catch (error: any) {
      console.error('Error saving testimonials:', error);
      toast.error(error.message || 'Failed to save testimonials');
    } finally {
      setSaving(false);
    }
  };

  const updateTestimonial = (index: number, field: string, value: string) => {
    const newTestimonials = [...testimonials];
    newTestimonials[index] = { ...newTestimonials[index], [field]: value };
    
    // Automatically generate avatar if name changes and there's no image
    if (field === 'name' && !newTestimonials[index].image) {
      const colors = ['FE6700', '7C3AED', '059669', '2563EB', 'DB2777'];
      const color = colors[index % colors.length];
      newTestimonials[index].image = `https://ui-avatars.com/api/?name=${encodeURIComponent(value)}&background=${color}&color=FFFFFF&size=600&bold=true`;
    }
    
    setTestimonials(newTestimonials);
  };

  const addTestimonial = () => {
    setTestimonials([
      ...testimonials,
      { name: '', role: '', location: '', tag: '', quote: '', image: '' },
    ]);
  };

  const removeTestimonial = (index: number) => {
    const newTestimonials = [...testimonials];
    newTestimonials.splice(index, 1);
    setTestimonials(newTestimonials);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Website Content</h1>
          <p className="text-muted-foreground mt-1">Manage content displayed on the public website</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Home Page Testimonials</h2>
            <p className="text-sm text-muted-foreground">Manage the testimonials shown on the home page.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addTestimonial}>
            <Plus className="w-4 h-4 mr-2" />
            Add Testimonial
          </Button>
        </div>

        {testimonials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No testimonials added yet. Click 'Add Testimonial' to create one.
          </div>
        ) : (
          <div className="space-y-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-4 border border-border rounded-lg bg-background relative group">
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-8 w-8 shadow-sm"
                  onClick={() => removeTestimonial(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Name</label>
                    <Input
                      value={testimonial.name}
                      onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                      placeholder="e.g. Anita Kapoor"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Role / Relation</label>
                    <Input
                      value={testimonial.role}
                      onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                      placeholder="e.g. Daughter · caring for her 82-year-old mother"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Location</label>
                    <Input
                      value={testimonial.location}
                      onChange={(e) => updateTestimonial(index, 'location', e.target.value)}
                      placeholder="e.g. New Delhi"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Highlight Tag</label>
                    <Input
                      value={testimonial.tag}
                      onChange={(e) => updateTestimonial(index, 'tag', e.target.value)}
                      placeholder="e.g. Found a Care Mitra in 2 days"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium">Image URL</label>
                    <Input
                      value={testimonial.image}
                      onChange={(e) => updateTestimonial(index, 'image', e.target.value)}
                      placeholder="https://ui-avatars.com/api/?name=..."
                    />
                    <p className="text-[10px] text-muted-foreground">Generated automatically from name if left empty.</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium">Quote</label>
                    <Textarea
                      value={testimonial.quote}
                      onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                      placeholder="The actual testimonial text..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
