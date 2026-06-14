import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function RiskTrendChartCard({ data }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 h-[20rem]">
      <h3 className="text-base font-black text-white mb-3">Risk Trend</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
          <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis
            domain={[1, 3]}
            ticks={[1, 2, 3]}
            tickFormatter={(v) => (v === 1 ? 'Low' : v === 2 ? 'Med' : 'High')}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip />
          <Line type="monotone" dataKey="riskNumeric" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SleepStudyBarCard({ data }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 h-[20rem]">
      <h3 className="text-base font-black text-white mb-3">Sleep vs Study</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
          <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="sleep" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="study_hours" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MoodAreaCard({ moodData }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 h-[20rem]">
      <h3 className="text-base font-black text-white mb-3">Mood Patterns</h3>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={moodData}>
          <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
          <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[1, 5]} />
          <Tooltip />
          <Area type="monotone" dataKey="mood_score" stroke="#f43f5e" fill="#f43f5e55" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeerBenchmarkCard({ analytics }) {
  const chartData = analytics?.peer_benchmark || [];
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 h-[20rem]">
      <h3 className="text-base font-black text-white mb-3">Peer Benchmarking</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
          <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="student_value" name="You" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          <Bar dataKey="class_average" name="Class Avg" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardCharts({ chartData, moodData, analytics }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <RiskTrendChartCard data={chartData} />
      <SleepStudyBarCard data={chartData} />
      <MoodAreaCard moodData={moodData} />
      <PeerBenchmarkCard analytics={analytics} />
    </div>
  );
}
