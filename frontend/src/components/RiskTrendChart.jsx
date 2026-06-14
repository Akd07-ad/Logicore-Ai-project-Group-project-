import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const riskToColor = { Low: '#06b6d4', Medium: '#f59e0b', High: '#dc2626' };

export default function RiskTrendChart({ chartData, pulsePointId }) {
  return (
    <div className="h-[18rem] sm:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ left: 10, right: 10, top: 20, bottom: 10 }}>
          <defs>
            <linearGradient id="riskGradientLive" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="5 5" stroke="#1f2937" vertical={false} />
          <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[1, 3]}
            ticks={[1, 2, 3]}
            tickFormatter={(v) => (v === 1 ? 'Low' : v === 2 ? 'Medium' : 'High')}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
            formatter={(value) => (value === 1 ? 'Low' : value === 2 ? 'Medium' : 'High')}
          />
          <Line
            type="monotone"
            dataKey="riskNumeric"
            stroke="url(#riskGradientLive)"
            strokeWidth={4}
            animationDuration={650}
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (!cx || !cy) return null;
              const color = riskToColor[payload.risk_result] || '#a78bfa';
              return (
                <g>
                  <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#0f172a" strokeWidth={2} />
                  {payload.id === pulsePointId && (
                    <motion.circle
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={2}
                      initial={{ opacity: 0.8, r: 8 }}
                      animate={{ opacity: 0, r: 18 }}
                      transition={{ duration: 1.1, ease: 'easeOut' }}
                    />
                  )}
                </g>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
