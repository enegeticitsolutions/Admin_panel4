import React, { useState, useEffect } from 'react';
import { communityApi } from '../../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Calendar, 
  BookOpen, 
  Mic, 
  Users, 
  TrendingUp, 
  Loader2, 
  Plus, 
  ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router';

export default function CommunityDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalEvents: 0,
    upcomingEvents: 0,
    totalRegistrations: 0,
    totalBlogs: 0,
    totalPodcasts: 0,
    totalEpisodes: 0,
  });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [recentBlogs, setRecentBlogs] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await communityApi.getDashboard();
      if (res && res.stats) {
        setStats(res.stats);
        setRecentEvents(res.recentEvents || []);
        setRecentBlogs(res.recentBlogs || []);
      }
    } catch (e) {
      console.error('Failed to load community dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Community & Content Hub</h1>
          <p className="text-sm text-slate-500">
            Monitor upcoming elder workshops, health articles, and wellness podcasts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/community/events')} className="bg-[#FE6700] hover:bg-[#E05A00] text-white">
            <Plus className="mr-2 h-4 w-4" /> New Event
          </Button>
          <Button onClick={() => navigate('/community/blogs')} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> New Article
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Upcoming Events</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.upcomingEvents}</div>
            <p className="text-xs text-slate-500">{stats.totalEvents} total hosted events</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Event Registrations</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.totalRegistrations}</div>
            <p className="text-xs text-slate-500">Active RSVPs across all events</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Published Articles</CardTitle>
            <BookOpen className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.totalBlogs}</div>
            <p className="text-xs text-slate-500">Elder health & lifestyle articles</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Podcast Episodes</CardTitle>
            <Mic className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.totalEpisodes}</div>
            <p className="text-xs text-slate-500">Across {stats.totalPodcasts} audio series</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Worklist Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Events Card */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">Recent Community Events</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/community/events')} className="text-xs text-orange-600">
              View All <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No events found. Click "New Event" to get started.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-900">{evt.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(evt.startDateTime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        • {evt.eventType.toUpperCase()}
                      </p>
                    </div>
                    <Badge variant={evt.status === 'published' ? 'default' : 'secondary'}>
                      {evt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Blogs Card */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">Recent Health Articles</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/community/blogs')} className="text-xs text-orange-600">
              View All <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentBlogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No articles found. Click "New Article" to create one.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentBlogs.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-900">{b.title}</p>
                      <p className="text-xs text-slate-500">
                        {b.category?.name || 'General'} • By {b.author?.name || 'MaiHoonNa Team'}
                      </p>
                    </div>
                    <Badge variant={b.status === 'published' ? 'default' : 'secondary'}>
                      {b.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

