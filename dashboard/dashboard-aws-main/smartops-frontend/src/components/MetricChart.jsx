import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const MetricChart = ({ data, title, dataKeys = ['value'], color = '#3b82f6' }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg" style={{ height: '320px' }}>
      <h3 className="text-slate-300 font-semibold mb-4">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-52 text-slate-500 italic text-sm">
          Collecting data from EKS cluster...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickMargin={6}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickMargin={6}
              width={55}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            {dataKeys.length > 1 ? (
              <>
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                {dataKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </>
            ) : (
              <Line
                type="monotone"
                dataKey={dataKeys[0]}
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default MetricChart;
