import React, { useEffect, useState } from 'react';
import { 
  Activity, Heart, Thermometer, Droplet, Scale, RefreshCw, 
  TrendingUp, Calendar, AlertCircle, User, CheckCircle2 
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { vitalsApi, VitalTrend, VitalDataPoint } from '../../../services/api';

interface VitalsTrendsCardProps {
  beneficiaryId: string;
}

// Icon mapper helper
const getVitalIcon = (code: string) => {
  const c = code.toUpperCase();
  if (c.includes('BP') || c === 'BLOOD_PRESSURE') return Activity;
  if (c.includes('PULSE') || c.includes('HEART')) return Heart;
  if (c.includes('SPO2') || c.includes('OXYGEN')) return Activity;
  if (c.includes('TEMP')) return Thermometer;
  if (c.includes('WEIGHT')) return Scale;
  if (c.includes('GLUCOSE') || c.includes('SUGAR')) return Droplet;
  return Activity;
};

// Custom Tooltip for rich presentation
const CustomChartTooltip = ({ active, payload, label, unit, dataType }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const v1Point = data._rawV1;
    const v2Point = data._rawV2;

    return (
      <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-2xl shadow-xl border border-gray-100 text-xs space-y-2 z-50 min-w-[170px]">
        <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
          <span className="font-bold text-gray-800">{data.date}</span>
          {data.time && <span className="text-[10px] font-semibold text-gray-400">{data.time}</span>}
        </div>

        {/* Primary reading */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 font-medium text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color }} />
            {dataType === 'dual_numeric' ? 'Systolic' : 'Reading'}:
          </span>
          <span className="font-black text-gray-900 text-sm">
            {data.value} {unit}
          </span>
        </div>

        {/* Secondary reading (e.g. Diastolic) */}
        {dataType === 'dual_numeric' && data.value2 !== undefined && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-medium text-gray-600">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[1]?.color || '#4B5563' }} />
              Diastolic:
            </span>
            <span className="font-black text-gray-900 text-sm">
              {data.value2} {unit}
            </span>
          </div>
        )}

        {/* Source / Recorder */}
        <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500">
          <span>Source:</span>
          <span className={`font-bold px-1.5 py-0.5 rounded-md ${v1Point?.source === 'beneficiary' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
            {v1Point?.source === 'beneficiary' ? 'Self-reported' : `Care Companion (${v1Point?.recorder || 'Staff'})`}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Customized Dot matching the mobile app style
const renderCustomDot = (props: any, color: string) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const isSelf = payload?._rawV1?.source === 'beneficiary';
  const dotRadius = 5;

  return (
    <circle
      key={`dot-${cx}-${cy}`}
      cx={cx}
      cy={cy}
      r={dotRadius}
      stroke={isSelf ? '#3B82F6' : color}
      strokeWidth={2.5}
      fill={isSelf ? '#DBEAFE' : '#FFFFFF'}
    />
  );
};

const renderCustomDot2 = (props: any, color: string) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const isSelf = payload?._rawV2?.source === 'beneficiary';
  const dotRadius = 5;

  return (
    <circle
      key={`dot2-${cx}-${cy}`}
      cx={cx}
      cy={cy}
      r={dotRadius}
      stroke={isSelf ? '#3B82F6' : color}
      strokeWidth={2.5}
      fill={isSelf ? '#DBEAFE' : '#FFFFFF'}
    />
  );
};

export const VitalsTrendsCard: React.FC<VitalsTrendsCardProps> = ({ beneficiaryId }) => {
  const [trends, setTrends] = useState<VitalTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointLimit, setPointLimit] = useState<number>(7);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTrends = async (limit: number = pointLimit) => {
    try {
      if (!isRefreshing) setLoading(true);
      const data = await vitalsApi.getTrends(beneficiaryId, { limit, days: 90 });
      setTrends(data);
    } catch (err) {
      console.error('Failed to load vitals trends:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (beneficiaryId) {
      fetchTrends(pointLimit);
    }
  }, [beneficiaryId, pointLimit]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTrends(pointLimit);
  };

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#FF7A00] flex items-center justify-center shadow-sm">
            <TrendingUp size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-800 tracking-tight">
              Vitals Trends ({pointLimit === 7 ? 'Last 7 Data Points' : `Last ${pointLimit} Data Points`})
            </h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              Comparative telemetry from Care Companions & Self-readings
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Points Filter */}
          <div className="flex items-center bg-gray-100/80 p-1 rounded-2xl">
            {[7, 14, 30].map(limit => (
              <button
                key={limit}
                onClick={() => setPointLimit(limit)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  pointLimit === limit
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {limit} Pts
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
            title="Refresh trends"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#FF7A00]' : ''} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !isRefreshing && (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#FF7A00]" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Loading vitals trends...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && trends.filter(t => (t.v1 && t.v1.length > 0) || (t.v2 && t.v2.length > 0)).length === 0 && (
        <div className="py-16 text-center bg-[#FAF8F5] rounded-3xl border border-dashed border-[#E7DED6] p-8">
          <Activity className="mx-auto w-10 h-10 text-gray-300 mb-3" />
          <h4 className="text-sm font-bold text-gray-700">No Vitals Readings Recorded</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Once a Care Companion captures vitals during a visit or the patient self-reports, their trend line will appear here.
          </p>
        </div>
      )}

      {/* Grid of Vital Charts */}
      {!loading && trends.filter(t => (t.v1 && t.v1.length > 0) || (t.v2 && t.v2.length > 0)).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {trends
            .filter(vital => (vital.v1 && vital.v1.length > 0) || (vital.v2 && vital.v2.length > 0))
            .map(vital => {
            const Icon = getVitalIcon(vital.code);
            const isDual = vital.dataType === 'dual_numeric';

            // Merge v1 and v2 by index / timestamp into chart-friendly array
            const chartData = (vital.v1 || []).map((p1, idx) => {
              const p2 = vital.v2 && vital.v2[idx] ? vital.v2[idx] : undefined;
              return {
                date: p1.date,
                time: p1.time,
                fullDate: p1.fullDate,
                value: p1.value,
                value2: p2 ? p2.value : undefined,
                _rawV1: p1,
                _rawV2: p2,
              };
            });

            // Latest reading
            const latestV1 = vital.v1 && vital.v1.length > 0 ? vital.v1[vital.v1.length - 1] : null;
            const latestV2 = vital.v2 && vital.v2.length > 0 ? vital.v2[vital.v2.length - 1] : null;

            // Check if any reading is self-reported
            const hasSelfReported = (vital.v1 || []).some(p => p.source === 'beneficiary') ||
              (vital.v2 || []).some(p => p.source === 'beneficiary');

            return (
              <div
                key={vital.code}
                className="bg-[#FAF8F5] rounded-[24px] p-5 border border-[#E7DED6] shadow-xs flex flex-col justify-between hover:border-orange-200 transition-all"
              >
                {/* Vital Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: vital.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">
                        {vital.name} {vital.unit ? `(${vital.unit})` : ''}
                      </h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {chartData.length} readings recorded
                      </p>
                    </div>
                  </div>

                  {/* Latest Value Badge */}
                  {latestV1 && (
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-white border border-gray-200 shadow-xs text-xs font-black text-gray-800">
                        {isDual && latestV2 ? `${latestV1.value}/${latestV2.value}` : latestV1.value}{' '}
                        <span className="text-[10px] text-gray-400 font-bold ml-1">{vital.unit}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Plot Area with Recharts */}
                <div className="h-44 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                        dy={6}
                      />
                      <YAxis
                        domain={[0, vital.gridMax || 'auto']}
                        ticks={vital.gridValues && vital.gridValues.length > 0 ? vital.gridValues : undefined}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                        dx={-4}
                      />
                      <Tooltip
                        content={
                          <CustomChartTooltip
                            unit={vital.unit}
                            dataType={vital.dataType}
                          />
                        }
                      />

                      {/* Normal Range Guidelines if present */}
                      {vital.normalMax && vital.normalMin && (
                        <ReferenceArea
                          y1={vital.normalMin}
                          y2={vital.normalMax}
                          fill={vital.color}
                          fillOpacity={0.05}
                        />
                      )}

                      {/* Primary Line (v1) */}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={vital.color}
                        strokeWidth={2.5}
                        isAnimationActive={true}
                        dot={(props: any) => renderCustomDot(props, vital.color)}
                        activeDot={{ r: 7, stroke: vital.color, strokeWidth: 3, fill: '#FFFFFF' }}
                      />

                      {/* Secondary Line (v2, e.g. Diastolic) */}
                      {isDual && (
                        <Line
                          type="monotone"
                          dataKey="value2"
                          stroke={vital.color2 || '#4B5563'}
                          strokeWidth={2.5}
                          isAnimationActive={true}
                          dot={(props: any) => renderCustomDot2(props, vital.color2 || '#4B5563')}
                          activeDot={{ r: 7, stroke: vital.color2 || '#4B5563', strokeWidth: 3, fill: '#FFFFFF' }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Footer Legend */}
                <div className="mt-3 pt-3 border-t border-gray-200/60 flex flex-wrap items-center justify-between text-[11px] text-gray-500 font-medium">
                  {/* Dual numeric indicator (Systolic vs Diastolic) */}
                  {isDual ? (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vital.color }} />
                        <span className="font-bold text-gray-700">Systolic</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vital.color2 || '#4B5563' }} />
                        <span className="font-bold text-gray-700">Diastolic</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {vital.normalMin && vital.normalMax ? `Target: ${vital.normalMin} - ${vital.normalMax} ${vital.unit}` : 'Standard telemetry'}
                    </span>
                  )}

                  {/* Care Companion vs Self-reported Legend */}
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full border-2 bg-white"
                        style={{ borderColor: vital.color }}
                      />
                      <span>Care Companion</span>
                    </span>
                    {hasSelfReported && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 bg-blue-100" />
                        <span>Self-reported</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VitalsTrendsCard;
