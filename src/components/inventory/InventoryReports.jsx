import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, differenceInHours } from 'date-fns';
import { TrendingUp, Clock, BarChart2 } from 'lucide-react';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4'];

const CATEGORY_LABELS = {
  toiletries: 'Toiletries',
  cleaning_supplies: 'Cleaning',
  pantry: 'Pantry',
  paper_goods: 'Paper Goods',
  laundry: 'Laundry',
  first_aid: 'First Aid',
  other: 'Other',
};

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function InventoryReports({ requests, items }) {
  // --- 1. Most requested items (top 10 by count) ---
  const topItems = useMemo(() => {
    const counts = {};
    requests.forEach(r => {
      const key = r.item_name || 'Unknown';
      counts[key] = (counts[key] || 0) + (r.quantity_requested || 1);
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, count }));
  }, [requests]);

  // --- 2. Avg fulfillment time by category (hours from created→fulfilled) ---
  const fulfillmentByCategory = useMemo(() => {
    const catData = {};
    requests
      .filter(r => r.status === 'fulfilled' && r.updated_date && r.created_date)
      .forEach(r => {
        const cat = r.category || 'other';
        const hrs = differenceInHours(new Date(r.updated_date), new Date(r.created_date));
        if (hrs >= 0) {
          if (!catData[cat]) catData[cat] = { total: 0, count: 0 };
          catData[cat].total += hrs;
          catData[cat].count += 1;
        }
      });
    return Object.entries(catData).map(([cat, { total, count }]) => ({
      category: CATEGORY_LABELS[cat] || cat,
      avgHours: Math.round(total / count),
    })).sort((a, b) => a.avgHours - b.avgHours);
  }, [requests]);

  // --- 3. Monthly requests for past 6 months ---
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return {
        month: format(d, 'MMM'),
        start: startOfMonth(d),
        end: endOfMonth(d),
        requests: 0,
        fulfilled: 0,
      };
    });
    requests.forEach(r => {
      if (!r.created_date) return;
      const d = new Date(r.created_date);
      const bucket = months.find(m => d >= m.start && d <= m.end);
      if (bucket) {
        bucket.requests += 1;
        if (r.status === 'fulfilled') bucket.fulfilled += 1;
      }
    });
    return months.map(({ month, requests, fulfilled }) => ({ month, requests, fulfilled }));
  }, [requests]);

  // --- 4. Category breakdown pie ---
  const categoryBreakdown = useMemo(() => {
    const counts = {};
    requests.forEach(r => {
      const cat = r.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([cat, value]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [requests]);

  const hasData = requests.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-16 text-slate-400">
        <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No request data yet</p>
        <p className="text-xs mt-1">Charts will appear once supply requests are submitted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Row 1: Top items + Category pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section icon={TrendingUp} title="Most Requested Items">
          {topItems.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topItems} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={v => [v, 'Units requested']}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section icon={BarChart2} title="Requests by Category">
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={v => [v, 'Requests']}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Row 2: Monthly consumption */}
      <Section icon={TrendingUp} title="Monthly Requests & Fulfillment (Last 6 Months)">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="requests" name="Total Requests" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="fulfilled" name="Fulfilled" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* Row 3: Avg fulfillment time */}
      <Section icon={Clock} title="Avg. Fulfillment Time by Category (hours)">
        {fulfillmentByCategory.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No fulfilled requests yet — data will appear once requests are marked fulfilled.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fulfillmentByCategory} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="h" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={v => [`${v}h`, 'Avg. fulfillment time']}
              />
              <Bar dataKey="avgHours" name="Avg Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>
    </div>
  );
}