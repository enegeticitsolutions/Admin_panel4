import React, { useState, useEffect, useRef } from 'react';
import { communityApi, apiJson } from '../../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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
  Calendar, 
  Video, 
  MapPin, 
  Loader2, 
  Search, 
  Users, 
  Upload, 
  ImageIcon, 
  X, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';
import { toast } from 'sonner';

export type EventTimelineStatus = 'ongoing' | 'upcoming' | 'past';

export function getEventTimeline(startDateTime: string | Date, endDateTime: string | Date): EventTimelineStatus {
  const now = Date.now();
  const start = new Date(startDateTime).getTime();
  const end = new Date(endDateTime).getTime();
  if (now >= start && now <= end) return 'ongoing';
  if (now < start) return 'upcoming';
  return 'past';
}

export default function CommunityEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'past'>('all');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [eventType, setEventType] = useState('online');
  const [accessTier, setAccessTier] = useState('free'); // 'free' | 'subscribers_only'
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('100');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [thumbnailKey, setThumbnailKey] = useState('');
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');
  const [ranking, setRanking] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, catsRes] = await Promise.all([
        communityApi.getEvents(),
        communityApi.getCategories(),
      ]);
      setEvents(eventsRes || []);
      setCategories(catsRes || []);
      if (catsRes && catsRes.length > 0) setCategoryId(catsRes[0].id);
    } catch (err: any) {
      console.error('Error loading events:', err);
      toast.error('Failed to load events data');
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
      formData.append('folder', 'community/events');

      const res = await apiJson<{ url: string; storageKey: string }>('/community/upload-media', {
        method: 'POST',
        body: formData,
      });

      if (res?.storageKey) {
        setThumbnailKey(res.storageKey);
        setThumbnailPreviewUrl(res.url);
        toast.success('Thumbnail uploaded successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload thumbnail');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDateTime || !endDateTime) {
      toast.error('Please enter title, start time, and end time');
      return;
    }

    try {
      setSaving(true);
      await communityApi.createEvent({
        title,
        shortDescription,
        categoryId: categoryId || (categories[0]?.id || null),
        eventType,
        accessTier,
        city: city || null,
        state: state || null,
        startDateTime,
        endDateTime,
        maxCapacity: parseInt(maxCapacity || '100', 10),
        meetingUrl: eventType === 'online' ? meetingUrl : null,
        venueName: eventType !== 'online' ? venueName : null,
        venueAddress: eventType !== 'online' ? venueAddress : null,
        thumbnailKey: thumbnailKey || null,
        ranking: ranking ? parseInt(ranking, 10) : null,
        status: 'published',
      });
      toast.success('Event published successfully!');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const rankMap = React.useMemo(() => {
    const map = new Map<number, any>();
    events.forEach((ev) => {
      if (typeof ev.ranking === 'number' && ev.ranking >= 1 && ev.ranking <= 5) {
        map.set(ev.ranking, ev);
      }
    });
    return map;
  }, [events]);

  const handleUpdateRanking = async (eventId: string, newRank: number | null) => {
    const displaced = newRank ? events.find((e) => e.id !== eventId && e.ranking === newRank) : null;

    // Optimistically update local state so only one event can hold the rank at a time
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) return { ...e, ranking: newRank };
        if (newRank !== null && e.ranking === newRank) return { ...e, ranking: null };
        return e;
      })
    );

    try {
      await communityApi.updateEvent(eventId, { ranking: newRank });
      if (displaced) {
        toast.success(`Top ${newRank} assigned (reassigned from "${displaced.title.trim()}")`);
      } else if (newRank) {
        toast.success(`Rank updated to Top ${newRank}`);
      } else {
        toast.success('Rank removed');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ranking');
      loadData();
    }
  };

  const resetForm = () => {
    setTitle('');
    setShortDescription('');
    setEventType('online');
    setAccessTier('free');
    setCity('');
    setState('');
    setStartDateTime('');
    setEndDateTime('');
    setMaxCapacity('100');
    setMeetingUrl('');
    setVenueName('');
    setVenueAddress('');
    setThumbnailKey('');
    setThumbnailPreviewUrl('');
    setRanking('');
  };

  const upcomingCount = events.filter((e) => getEventTimeline(e.startDateTime, e.endDateTime) === 'upcoming').length;
  const ongoingCount = events.filter((e) => getEventTimeline(e.startDateTime, e.endDateTime) === 'ongoing').length;
  const pastCount = events.filter((e) => getEventTimeline(e.startDateTime, e.endDateTime) === 'past').length;

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.city && e.city.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    if (timelineFilter === 'all') return true;
    return getEventTimeline(e.startDateTime, e.endDateTime) === timelineFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Events Management</h1>
          <p className="text-sm text-slate-500">
            Create, publish, and monitor webinars, workshops, and wellness sessions.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
          <Plus className="mr-2 h-4 w-4" /> Create Event
        </Button>
      </div>

      {/* Timeline Tabs & Search Filter */}
      <Card className="border-slate-200">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={() => setTimelineFilter('all')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                timelineFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Events
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  timelineFilter === 'all' ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {events.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimelineFilter('upcoming')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                timelineFilter === 'upcoming'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Upcoming Events
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  timelineFilter === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-700'
                }`}
              >
                {upcomingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimelineFilter('ongoing')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                timelineFilter === 'ongoing'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Ongoing Events
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  timelineFilter === 'ongoing' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {ongoingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimelineFilter('past')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                timelineFilter === 'past'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Past Events
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  timelineFilter === 'past' ? 'bg-slate-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pastCount}
              </span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={`Search ${timelineFilter === 'all' ? 'all' : timelineFilter} events by title or city...`}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
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
                  <TableHead>Event Details</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Schedule Status</TableHead>
                  <TableHead>Type & Access</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Registrations</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                      No events found in this category. Click "Create Event" to schedule a session.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => {
                    const timeline = getEventTimeline(event.startDateTime, event.endDateTime);

                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {event.resolvedThumbnailUrl ? (
                              <img
                                src={event.resolvedThumbnailUrl}
                                alt={event.title}
                                className="h-12 w-16 rounded-md object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="flex h-12 w-16 items-center justify-center rounded-md bg-slate-100 border border-slate-200 text-slate-400">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{event.title}</div>
                              <div className="line-clamp-1 text-xs text-slate-500">{event.shortDescription}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            value={event.ranking || ''}
                            onChange={(e) => handleUpdateRanking(event.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white font-medium text-slate-700 hover:border-orange-400 cursor-pointer focus:outline-none"
                          >
                            <option value="">None</option>
                            {[1, 2, 3, 4, 5].map((r) => {
                              const occupant = rankMap.get(r);
                              const isCurrent = event.ranking === r;
                              const medal = r === 1 ? '🏆' : r === 2 ? '🥈' : r === 3 ? '🥉' : '';
                              let label = `Top ${r} ${medal}`.trim();
                              if (occupant && !isCurrent) {
                                const occTitle = occupant.title.trim();
                                label += ` (Takes from: ${occTitle.length > 14 ? occTitle.slice(0, 14) + '...' : occTitle})`;
                              }
                              return (
                                <option key={r} value={r}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </TableCell>
                        <TableCell>
                          {timeline === 'ongoing' && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1.5 w-fit shadow-xs font-semibold text-xs py-1">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-200 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                              </span>
                              Ongoing Now
                            </Badge>
                          )}
                          {timeline === 'upcoming' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5 w-fit font-medium text-xs py-1">
                              <Calendar className="h-3 w-3 text-blue-600" /> Upcoming
                            </Badge>
                          )}
                          {timeline === 'past' && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 flex items-center gap-1.5 w-fit font-normal text-xs py-1">
                              Past Event
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="capitalize w-fit">
                            {event.eventType === 'online' ? (
                              <Video className="mr-1 h-3 w-3 text-blue-500" />
                            ) : (
                              <MapPin className="mr-1 h-3 w-3 text-amber-500" />
                            )}
                            {event.eventType}
                          </Badge>
                          {event.accessTier === 'subscribers_only' ? (
                            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 text-[10px] w-fit">
                              <ShieldCheck className="mr-1 h-3 w-3" /> Package Only
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] w-fit">
                              <Globe className="mr-1 h-3 w-3" /> Free for All
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-700">
                          {event.city ? `${event.city}${event.state ? `, ${event.state}` : ''}` : (event.eventType === 'online' ? 'Online / Virtual' : '—')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{event.category?.name || 'General'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-900">
                          {new Date(event.startDateTime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(event.startDateTime).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {event._count?.registrations || event.currentRegistrations || 0} / {event.maxCapacity}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Community Event</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateEvent} className="space-y-4">
            {/* Event Title */}
            <div>
              <label className="text-xs font-semibold text-slate-700">Event Title *</label>
              <Input
                placeholder="e.g. Heart Health & Gentle Yoga for Elders"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Event Thumbnail Image</label>
              <div className="flex items-center gap-4">
                {thumbnailPreviewUrl ? (
                  <div className="relative h-20 w-32 rounded-lg border border-slate-200 overflow-hidden group">
                    <img src={thumbnailPreviewUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
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
                  Upload promotional banner or cover art for mobile app cards (JPEG, PNG, WEBP).
                </p>
              </div>
            </div>

            {/* Short Description */}
            <div>
              <label className="text-xs font-semibold text-slate-700">Short Description</label>
              <Input
                placeholder="Brief summary for mobile cards"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
              />
            </div>

            {/* Category & Event Type */}
            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-xs font-semibold text-slate-700">Event Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  <option value="online">Online (Zoom / Meet)</option>
                  <option value="offline">Offline (In-Person Venue)</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            {/* Access Tier: Free vs Subscribers Only & Showcase Ranking */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs font-semibold text-slate-700">Access Entitlement *</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={accessTier}
                  onChange={(e) => setAccessTier(e.target.value)}
                >
                  <option value="free">Free for All Users (Public & App Installs)</option>
                  <option value="subscribers_only">Subscribers with Active Package Only</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {accessTier === 'subscribers_only'
                    ? '🔒 Gated: Active care plan package required.'
                    : '🌐 Open: Any registered app user can RSVP.'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs font-semibold text-slate-700">Showcase Ranking (Top 1–5)</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={ranking}
                  onChange={(e) => setRanking(e.target.value)}
                >
                  <option value="">None (Standard date order)</option>
                  {[1, 2, 3, 4, 5].map((r) => {
                    const occupant = rankMap.get(r);
                    const medal = r === 1 ? '🏆' : r === 2 ? '🥈' : r === 3 ? '🥉' : '';
                    let label = `Top ${r} ${medal}`.trim();
                    if (occupant) {
                      const occTitle = occupant.title.trim();
                      label += ` (Takes from: ${occTitle.length > 18 ? occTitle.slice(0, 18) + '...' : occTitle})`;
                    }
                    return (
                      <option key={r} value={r}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Only 1 event can hold each rank. Assigning an occupied rank displaces the other event.
                </p>
              </div>
            </div>

            {/* Location: City & State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">City</label>
                <Input
                  placeholder="e.g. Delhi NCR, Mumbai, Bengaluru"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">State</label>
                <Input
                  placeholder="e.g. Delhi, Maharashtra, Karnataka"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Start Date & Time *</label>
                <Input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">End Date & Time *</label>
                <Input
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Online / Venue Details */}
            {eventType === 'online' ? (
              <div>
                <label className="text-xs font-semibold text-slate-700">Meeting Link (Zoom / Google Meet)</label>
                <Input
                  placeholder="https://meet.google.com/..."
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Venue Name</label>
                  <Input
                    placeholder="Community Center Hall A"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Venue Address</label>
                  <Input
                    placeholder="Full physical street address"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700">Max Capacity (Seats)</label>
              <Input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
