import React, { useState, useEffect, useRef } from 'react';
import { communityApi, apiJson } from '../../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../components/ui/dialog';
import { 
  Plus, 
  BookOpen, 
  Loader2, 
  Search, 
  Eye, 
  Heart, 
  Upload, 
  ImageIcon, 
  X 
} from 'lucide-react';
import { toast } from 'sonner';

export default function CommunityBlogsPage() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // New Blog Form
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [richContent, setRichContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [readingTimeMinutes, setReadingTimeMinutes] = useState('3');
  const [thumbnailKey, setThumbnailKey] = useState('');
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [blogsRes, catsRes, authorsRes] = await Promise.all([
        communityApi.getBlogs(),
        communityApi.getCategories(),
        communityApi.getAuthors(),
      ]);
      setBlogs(blogsRes || []);
      setCategories(catsRes || []);
      setAuthors(authorsRes || []);
      if (catsRes?.length > 0) setCategoryId(catsRes[0].id);
      if (authorsRes?.length > 0) setAuthorId(authorsRes[0].id);
    } catch (e: any) {
      console.error('Error loading blogs:', e);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP)');
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'community/blogs');

      const res = await apiJson<{ url: string; storageKey: string }>('/community/upload-media', {
        method: 'POST',
        body: formData,
      });

      if (res?.storageKey) {
        setThumbnailKey(res.storageKey);
        setThumbnailPreviewUrl(res.url);
        toast.success('Article cover uploaded!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload cover');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !richContent) {
      toast.error('Title and content are required');
      return;
    }

    try {
      setSaving(true);
      await communityApi.createBlog({
        title,
        shortDescription: shortDescription || title,
        richContent,
        categoryId: categoryId || (categories[0]?.id || null),
        authorId: authorId || null,
        readingTimeMinutes: parseInt(readingTimeMinutes || '3', 10),
        thumbnailKey: thumbnailKey || null,
        status: 'published',
      });
      toast.success('Article published successfully!');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish article');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setShortDescription('');
    setRichContent('');
    setThumbnailKey('');
    setThumbnailPreviewUrl('');
    setReadingTimeMinutes('3');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Health Blogs & Articles</h1>
          <p className="text-sm text-slate-500">
            Publish expert medical guides, lifestyle tips, and geriatric advice.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
          <Plus className="mr-2 h-4 w-4" /> New Article
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
                  <TableHead>Article</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      No articles published yet. Click "New Article" to create your first guide.
                    </TableCell>
                  </TableRow>
                ) : (
                  blogs.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {b.resolvedThumbnailUrl ? (
                            <img
                              src={b.resolvedThumbnailUrl}
                              alt={b.title}
                              className="h-12 w-16 rounded-md object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="flex h-12 w-16 items-center justify-center rounded-md bg-slate-100 border border-slate-200 text-slate-400">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900">{b.title}</div>
                            <div className="line-clamp-1 text-xs text-slate-500">{b.shortDescription}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.category?.name || 'General'}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">{b.author?.name || 'MaiHoonNa Team'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {b.viewCount || 0}</span>
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-red-500" /> {b.likeCount || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'published' ? 'default' : 'secondary'}>{b.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(b.publishedAt || b.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Blog Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Write New Health Article</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateBlog} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Article Title *</label>
              <Input
                placeholder="e.g. 5 Simple Daily Exercises to Prevent Knee Pain in Seniors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Article Cover Image</label>
              <div className="flex items-center gap-4">
                {thumbnailPreviewUrl ? (
                  <div className="relative h-20 w-32 rounded-lg border border-slate-200 overflow-hidden">
                    <img src={thumbnailPreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailKey('');
                        setThumbnailPreviewUrl('');
                      }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-slate-400" />
                        <span className="text-[11px] text-slate-500 mt-1">Upload Photo</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleThumbnailUpload}
                  accept="image/*"
                  className="hidden"
                />
                <p className="text-xs text-slate-400 flex-1">
                  Featured header image shown at the top of the article reader.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Author</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                >
                  <option value="">MaiHoonNa Medical Board</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Reading Time (Mins)</label>
                <Input
                  type="number"
                  value={readingTimeMinutes}
                  onChange={(e) => setReadingTimeMinutes(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Short Summary</label>
              <Input
                placeholder="One-sentence teaser for mobile cards"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Article Body *</label>
              <Textarea
                placeholder="Full article content (supports paragraphs and headings)..."
                rows={8}
                value={richContent}
                onChange={(e) => setRichContent(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish Article
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
