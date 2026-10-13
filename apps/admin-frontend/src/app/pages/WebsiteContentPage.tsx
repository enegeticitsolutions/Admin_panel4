import React, { useState, useEffect, useRef } from 'react';
import { apiJson } from '../../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Sparkles, 
  Link as LinkIcon, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { toast } from 'sonner';

interface Testimonial {
  name: string;
  title?: string;
  role: string;
  location: string;
  tag: string;
  quote: string;
  image: string;
}

export default function WebsiteContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [showUrlInputs, setShowUrlInputs] = useState<Record<number, boolean>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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
      toast.success('Testimonials updated and published to website successfully!');
    } catch (error: any) {
      console.error('Error saving testimonials:', error);
      toast.error(error.message || 'Failed to save testimonials');
    } finally {
      setSaving(false);
    }
  };

  const updateTestimonial = (index: number, field: keyof Testimonial, value: string) => {
    const updated = [...testimonials];
    const current = { ...updated[index], [field]: value };

    // Auto-sync highlight tag if tag is empty when title is typed
    if (field === 'title' && (!current.tag || current.tag === updated[index].title)) {
      current.tag = value;
    }

    // Automatically generate avatar if name changes and there's no custom photo uploaded
    if (field === 'name' && (!current.image || current.image.includes('ui-avatars.com'))) {
      const colors = ['FE6700', '7C3AED', '059669', '2563EB', 'DB2777'];
      const color = colors[index % colors.length];
      current.image = `https://ui-avatars.com/api/?name=${encodeURIComponent(value || 'User')}&background=${color}&color=FFFFFF&size=600&bold=true`;
    }

    updated[index] = current;
    setTestimonials(updated);
  };

  const handleFileUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, WEBP, HEIC)');
      return;
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    try {
      setUploadingIndex(index);
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiJson<{ url: string; storageKey?: string }>('/website-content/upload-image', {
        method: 'POST',
        body: formData,
      });

      const uploadedUrl = response?.url || response?.storageKey;
      if (uploadedUrl) {
        const updated = [...testimonials];
        updated[index] = { ...updated[index], image: uploadedUrl };
        setTestimonials(updated);
        toast.success(`Photo uploaded for ${testimonials[index].name || `Testimonial #${index + 1}`}`);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload photo. Please check your network or try again.');
    } finally {
      setUploadingIndex(null);
      // Reset input value so re-selecting same file works
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    const updated = [...testimonials];
    const name = updated[index].name || 'User';
    const colors = ['FE6700', '7C3AED', '059669', '2563EB', 'DB2777'];
    const color = colors[index % colors.length];
    updated[index] = {
      ...updated[index],
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=FFFFFF&size=600&bold=true`,
    };
    setTestimonials(updated);
    toast.info('Custom photo removed. Reverted to default avatar.');
  };

  const addTestimonial = () => {
    const colors = ['FE6700', '7C3AED', '059669', '2563EB', 'DB2777'];
    const color = colors[testimonials.length % colors.length];
    setTestimonials([
      ...testimonials,
      {
        name: '',
        title: '',
        role: '',
        location: '',
        tag: '',
        quote: '',
        image: `https://ui-avatars.com/api/?name=New+User&background=${color}&color=FFFFFF&size=600&bold=true`,
      },
    ]);
  };

  const removeTestimonial = (index: number) => {
    const updated = [...testimonials];
    updated.splice(index, 1);
    setTestimonials(updated);
  };

  const toggleUrlInput = (index: number) => {
    setShowUrlInputs(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading website content...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Website Content</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage live testimonials and media displayed publicly on the main homepage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save & Publish Changes
          </Button>
        </div>
      </div>

      {/* Testimonials Management Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Home Page Testimonials</h2>
              <Badge variant="secondary" className="text-xs">
                {testimonials.length} {testimonials.length === 1 ? 'review' : 'reviews'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              These testimonials are public and visible to everyone visiting the website without needing login.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addTestimonial} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add Testimonial
          </Button>
        </div>

        {testimonials.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="text-sm font-medium">No testimonials yet</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Click 'Add Testimonial' to upload photos, quotes, and titles for your public landing page.
            </p>
            <Button size="sm" onClick={addTestimonial} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Add First Testimonial
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {testimonials.map((testimonial, index) => {
              const isUploading = uploadingIndex === index;
              const hasCustomPhoto = testimonial.image && !testimonial.image.includes('ui-avatars.com');
              const displayImage = testimonial.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name || 'User')}&background=FE6700&color=FFFFFF&size=600&bold=true`;

              return (
                <div 
                  key={index} 
                  className="p-5 border border-border rounded-xl bg-background/50 hover:border-primary/40 transition-all space-y-5 relative group shadow-xs"
                >
                  {/* Card Header & Controls */}
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {testimonial.name ? testimonial.name : `Testimonial #${index + 1}`}
                      </span>
                      {testimonial.tag && (
                        <Badge variant="outline" className="text-[11px] bg-green-50 text-green-700 border-green-200">
                          {testimonial.tag}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                      onClick={() => removeTestimonial(index)}
                      title="Delete this testimonial"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      <span className="text-xs">Remove</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Photo Upload & Preview (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col items-center sm:items-start space-y-3 p-4 rounded-lg bg-card/60 border border-border/80">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        Testimonial Photo
                      </label>

                      {/* Photo Preview Box */}
                      <div className="relative w-full max-w-[200px] aspect-4/3 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center shadow-xs">
                        <img
                          src={displayImage}
                          alt={testimonial.name || 'Testimonial portrait'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to avatar if broken image
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name || 'User')}&background=FE6700&color=FFFFFF&size=600&bold=true`;
                          }}
                        />

                        {isUploading && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center text-xs text-primary font-medium">
                            <Loader2 className="w-6 h-6 animate-spin mb-1 text-primary" />
                            Uploading...
                          </div>
                        )}

                        {testimonial.tag && !isUploading && (
                          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-full truncate text-center">
                            {testimonial.tag}
                          </div>
                        )}
                      </div>

                      {/* Upload Controls */}
                      <div className="w-full space-y-2">
                        {/* Hidden file input */}
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[index] = el; }}
                          onChange={(e) => handleFileUpload(index, e)}
                          accept="image/*"
                          className="hidden"
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="flex-1 text-xs"
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[index]?.click()}
                          >
                            {isUploading ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {hasCustomPhoto ? 'Change Photo' : 'Upload Photo'}
                          </Button>

                          {hasCustomPhoto && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground hover:text-destructive h-8 px-2"
                              onClick={() => removePhoto(index)}
                              title="Reset to default avatar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>

                        <p className="text-[10px] text-muted-foreground">
                          Supports JPG, PNG, WEBP, HEIC (Max 10MB). Image is automatically hosted & optimized.
                        </p>

                        {/* Optional URL Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleUrlInput(index)}
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 pt-1 font-medium"
                        >
                          <LinkIcon className="w-3 h-3" />
                          {showUrlInputs[index] ? 'Hide image URL' : 'Or use direct image URL'}
                          {showUrlInputs[index] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showUrlInputs[index] && (
                          <div className="pt-1.5 space-y-1">
                            <Input
                              value={testimonial.image}
                              onChange={(e) => updateTestimonial(index, 'image', e.target.value)}
                              placeholder="https://..."
                              className="text-xs h-8"
                            />
                            <p className="text-[10px] text-muted-foreground">Enter external photo URL</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Content & Metadata Fields (8 cols) */}
                    <div className="lg:col-span-8 space-y-4">
                      {/* Title & Tag in top row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground flex items-center justify-between">
                            <span>Testimonial Title / Headline</span>
                            <span className="text-[10px] text-muted-foreground">Public</span>
                          </label>
                          <Input
                            value={testimonial.title || ''}
                            onChange={(e) => updateTestimonial(index, 'title', e.target.value)}
                            placeholder="e.g. Found a Care Mitra in 2 days"
                            className="text-sm font-medium"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground flex items-center justify-between">
                            <span>Highlight Tag / Badge</span>
                            <span className="text-[10px] text-muted-foreground">Pill Badge</span>
                          </label>
                          <Input
                            value={testimonial.tag}
                            onChange={(e) => updateTestimonial(index, 'tag', e.target.value)}
                            placeholder="e.g. Found a Care Mitra in 2 days"
                            className="text-sm"
                          />
                        </div>
                      </div>

                      {/* Author Details: Name, Role, Location */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Name</label>
                          <Input
                            value={testimonial.name}
                            onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                            placeholder="e.g. Anita Kapoor"
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Role / Relation</label>
                          <Input
                            value={testimonial.role}
                            onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                            placeholder="e.g. Daughter · caring for mother"
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Location</label>
                          <Input
                            value={testimonial.location}
                            onChange={(e) => updateTestimonial(index, 'location', e.target.value)}
                            placeholder="e.g. New Delhi"
                            className="text-sm"
                          />
                        </div>
                      </div>

                      {/* Quote Textarea */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground flex items-center justify-between">
                          <span>Quote / Review Text</span>
                          <span className="text-[10px] text-muted-foreground">Displayed in quotes</span>
                        </label>
                        <Textarea
                          value={testimonial.quote}
                          onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                          placeholder="What did they say about the care services..."
                          rows={3}
                          className="text-sm resize-y leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

