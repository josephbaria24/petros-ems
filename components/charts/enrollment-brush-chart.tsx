"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

type Enrollment = {
  date: string;
  enrollments: number;
};

export default function EnrollmentBrushChartRecharts({
  data = [],
  width = 900,
  height = 400,
}: {
  data: Enrollment[];
  width?: number;
  height?: number;
}) {
  const [filtered, setFiltered] = useState(data);

  const hasData = data.length > 0;

  const safeDomain = useMemo<[number, number]>(() => {
    if (!hasData) {
      const now = Date.now();
      return [now, now];
    }
    const values = data.map((d) => new Date(d.date).getTime());
    return [Math.min(...values), Math.max(...values)];
  }, [data, hasData]);

  const mainChartHeight = height * 0.55;
  const brushChartHeight = height * 0.25;

  return (
    <div className="w-full">
      {!hasData ? (
        <div className="h-[400px] w-full flex items-center justify-center text-sm text-muted-foreground">
          No enrollment data yet.
        </div>
      ) : (
        <>
          {/* MAIN FILTERED CHART */}
          <div style={{ width, height: mainChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filtered} margin={{ top: 20, right: 20, left: 50, bottom: 20 }}>
                <YAxis stroke="#ccc" tick={{ fill: "#ccc" }} />
                <XAxis
                  dataKey="date"
                  stroke="#ccc"
                  tick={{ fill: "#ccc" }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  formatter={(v: any) => [`${v} enrollments`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="enrollments"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* BRUSH CHART */}
          <div style={{ width, height: brushChartHeight }} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 20, left: 50, bottom: 10 }}>
                <YAxis hide domain={[0, "dataMax"]} />
                <XAxis
                  dataKey="date"
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />

                <Area
                  type="monotone"
                  dataKey="enrollments"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                />

                {/* BRUSH */}
                <Brush
                  dataKey="date"
                  radius={14}
                  travellerWidth={10}
                  height={brushChartHeight - 10}
                  stroke="#fff"
                  fill="#141454"
                  startIndex={Math.floor(data.length * 0.2)}
                  endIndex={Math.floor(data.length * 0.6)}
                  onChange={(range) => {
                    if (!range?.startIndex && !range?.endIndex)
                      return setFiltered(data);

                    const start = range.startIndex ?? 0;
                    const end = range.endIndex ?? data.length - 1;

                    const sliced = data.slice(start, end + 1);
                    setFiltered(sliced.length ? sliced : data);
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
