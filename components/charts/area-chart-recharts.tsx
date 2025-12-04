"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  data: any[];
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  hideBottomAxis?: boolean;
  hideLeftAxis?: boolean;
};

export default function AreaChartRecharts({
  data,
  width,
  height,
  fillColor,
  strokeColor,
  hideBottomAxis = false,
  hideLeftAxis = false,
}: Props) {
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 20, left: 50, bottom: 20 }}>
          {!hideLeftAxis && (
            <YAxis
              stroke="#ccc"
              tick={{ fill: "#ccc", fontSize: 12 }}
            />
          )}

          {!hideBottomAxis && (
            <XAxis
              dataKey="date"
              stroke="#ccc"
              tick={{ fill: "#ccc", fontSize: 12 }}
              tickFormatter={(v) => new Date(v).toLocaleDateString()}
            />
          )}

          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleDateString()}
            formatter={(v: any) => [`${v} enrollments`, ""]}
          />

          <Area
            type="monotone"
            dataKey="enrollments"
            stroke={strokeColor}
            fill={fillColor}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
