"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";

export function MarketBar({ tam = 12000000, sam = 3600000, som = 360000 }) {
  const data = [
    { name: "TAM", value: tam },
    { name: "SAM", value: sam },
    { name: "SOM", value: som },
  ];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UseOfFundsPie({ product = 0.45, growth = 0.35, ops = 0.2 }) {
  const data = [
    { name: "Product", value: product },
    { name: "Growth", value: growth },
    { name: "Ops", value: ops },
  ];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KPILine({ y1 = 60000, y2 = 200000, y3 = 600000 }) {
  const data = [
    { year: "Y1", mau: y1 },
    { year: "Y2", mau: y2 },
    { year: "Y3", mau: y3 },
  ];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="mau" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
