"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import Skeleton from "./Skeleton";

export function MarketBar({ tam = 12000000, sam = 3600000, som = 360000 }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ClientMarketBar tam={tam} sam={sam} som={som} />
    </Suspense>
  );
}
export function UseOfFundsPie({ product = 0.45, growth = 0.35, ops = 0.20 }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ClientUseOfFundsPie product={product} growth={growth} ops={ops} />
    </Suspense>
  );
}
export function KPILine({ y1 = 60000, y2 = 200000, y3 = 600000 }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ClientKPILine y1={y1} y2={y2} y3={y3} />
    </Suspense>
  );
}

// Create dynamically imported components
const ClientMarketBar = dynamic(() => 
  import('recharts').then(mod => {
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } = mod;
    return function MarketBarChart({tam,sam,som}:{tam:number;sam:number;som:number}) {
      const data = [{name:"TAM", value:tam},{name:"SAM", value:sam},{name:"SOM", value:som}];
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="value"/></BarChart>
          </ResponsiveContainer>
        </div>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

const ClientUseOfFundsPie = dynamic(() => 
  import('recharts').then(mod => {
    const { ResponsiveContainer, PieChart, Pie, Tooltip } = mod;
    return function UseOfFundsPieChart({product,growth,ops}:{product:number;growth:number;ops:number}) {
      const data = [{name:"Product",value:product},{name:"Growth",value:growth},{name:"Ops",value:ops}];
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={100}/><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

const ClientKPILine = dynamic(() => 
  import('recharts').then(mod => {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } = mod;
    return function KPILineChart({y1,y2,y3}:{y1:number;y2:number;y3:number}) {
      const data = [{year:"Y1",mau:y1},{year:"Y2",mau:y2},{year:"Y3",mau:y3}];
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}><XAxis dataKey="year"/><YAxis/><Tooltip/><Line type="monotone" dataKey="mau"/></LineChart>
          </ResponsiveContainer>
        </div>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);
