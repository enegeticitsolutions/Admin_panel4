import React, { useState, useEffect } from 'react';
import { communityApi } from '../../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../components/ui/dialog';
import { 
  Plus, 
  Mic, 
  Loader2, 
  Headphones, 
  Music, 
  Play, 
  Clock 
} from 'lucide-react';
import { toast } from 'sonner';

export default function CommunityPodcastsPage() {
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false);
  const [episodeDialogOpen, setEpisodeDialogOpen] = useState(false);
  const [selectedPodcastId, setSelectedPodcastId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New Series Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // New Episode Form
  const [epTitle, setEpTitle] = useState('');
  const [epDesc, setEpDesc] = useState('');
  const [epNumber, setEpNumber] = useState('1');
  const [audioUrl, setAudioUrl] = useState('');
  const [epDuration, setEpDuration] = useState('15');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [podcastsRes, catsRes] = await Promise.all([
        communityApi.getPodcasts(),
        communityApi.getCategories(),
      ]);
      setPodcasts(podcastsRes || []);
      setCategories(catsRes || []);
      if (catsRes?.length > 0) setCategoryId(catsRes[0].id);
    } catch (e: any) {
      toast.error('Failed to load podcasts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      setSaving(true);
      await communityApi.createPodcast({
        title,
        description,
        categoryId,
      });
      toast.success('Podcast series created!');
      setSeriesDialogOpen(false);
      setTitle('');
      setDescription('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create series');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPodcastId || !epTitle) return;

    try {
      setSaving(true);
      await communityApi.createEpisode(selectedPodcastId, {
        title: epTitle,
        description: epDesc,
        episodeNumber: parseInt(epNumber || '1', 10),
        audioStorageKey: audioUrl || 'community/podcasts/sample.mp3',
        durationSeconds: parseInt(epDuration || '15', 10) * 60,
        status: 'published',
      });
      toast.success('Episode added successfully!');
      setEpisodeDialogOpen(false);
      setEpTitle('');
      setEpDesc('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Podcasts & Audio Shows</h1>
          <p className="text-sm text-slate-500">
            Produce senior wellness podcasts, doctor talks, and mindfulness sessions.
          </p>
        </div>
        <Button onClick={() => setSeriesDialogOpen(true)} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
          <Plus className="mr-2 h-4 w-4" /> New Podcast Show
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : podcasts.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Headphones className="h-12 w-12 text-slate-400" />
            <p className="mt-4 text-base font-semibold text-slate-900">No Podcast Shows Yet</p>
            <p className="mt-1 text-sm text-slate-500">Create a podcast show to start uploading audio episodes.</p>
            <Button onClick={() => setSeriesDialogOpen(true)} className="mt-4 bg-[#FE6700] text-white">
              <Plus className="mr-2 h-4 w-4" /> Create First Show
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {podcasts.map((p) => (
            <Card key={p.id} className="border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <Badge variant="outline" className="mb-1">{p.category?.name || 'General'}</Badge>
                  <CardTitle className="text-lg font-bold text-slate-900">{p.title}</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedPodcastId(p.id);
                    setEpNumber(String((p.episodes?.length || 0) + 1));
                    setEpisodeDialogOpen(true);
                  }}
                  className="bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Episode
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>

                {/* Episodes List */}
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Episodes ({p.episodes?.length || 0})
                  </p>
                  {p.episodes?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No episodes added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {p.episodes?.map((ep: any) => (
                        <div key={ep.id} className="flex items-center justify-between rounded-md bg-slate-50 p-2.5">
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-orange-500" />
                            <div>
                              <p className="text-xs font-medium text-slate-900">
                                Ep {ep.episodeNumber}: {ep.title}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {Math.ceil((ep.durationSeconds || 600) / 60)} mins
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">Published</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Series Dialog */}
      <Dialog open={seriesDialogOpen} onOpenChange={setSeriesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Podcast Show</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSeries} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Show Title *</label>
              <Input
                placeholder="e.g. Golden Years: Senior Health & Wisdom"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
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
              <label className="text-xs font-semibold text-slate-700">Description</label>
              <Textarea
                placeholder="About this wellness podcast..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSeriesDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#FE6700] text-white">Create Show</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Episode Dialog */}
      <Dialog open={episodeDialogOpen} onOpenChange={setEpisodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Podcast Episode</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEpisode} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-700">Episode Title *</label>
                <Input
                  placeholder="e.g. Managing Hypertension in Winter"
                  value={epTitle}
                  onChange={(e) => setEpTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Ep Number</label>
                <Input
                  type="number"
                  value={epNumber}
                  onChange={(e) => setEpNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Audio File Key / URL</label>
              <Input
                placeholder="community/podcasts/ep-1.mp3"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Estimated Duration (Minutes)</label>
              <Input
                type="number"
                value={epDuration}
                onChange={(e) => setEpDuration(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Episode Notes</label>
              <Textarea
                placeholder="Key takeaways discussed in this episode..."
                value={epDesc}
                onChange={(e) => setEpDesc(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEpisodeDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#FE6700] text-white">Upload & Publish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

