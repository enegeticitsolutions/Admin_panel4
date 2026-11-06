import React, { useState, useEffect } from 'react';
import { communityApi } from '../../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, TrendingUp, Users, BookOpen, Mic, Calendar } from 'lucide-react';

export default function CommunityAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await communityApi.getDashboard();
      setData(res);
    } catch (e) {
      console.error(e);
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

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Community Analytics</h1>
        <p className="text-sm text-slate-500">
          Measure member engagement, event attendance rates, and article readership.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Event Conversion Rate</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {stats.totalEvents > 0 ? Math.round((stats.totalRegistrations / stats.totalEvents) * 10) / 10 : 0}
            </div>
            <p className="text-xs text-slate-500">Average attendees registered per event</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Content Volume</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {(stats.totalBlogs || 0) + (stats.totalEpisodes || 0)}
            </div>
            <p className="text-xs text-slate-500">Total health articles & audio episodes</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Community Reach</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">Active</div>
            <p className="text-xs text-slate-500">Accessible across all mobile app subscribers</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

