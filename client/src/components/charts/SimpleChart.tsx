import React from 'react';
interface ChartData {
  label: string;
  value: number;
  color?: string;
}
interface SimpleBarChartProps {
  data: ChartData[];
  height?: number;
  title?: string;
}
export function SimpleBarChart({
  data,
  height = 200,
  title
}: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  return (
    <div className="w-full">
      {title &&
      <h4 className="text-sm font-medium text-slate-700 mb-4">{title}</h4>
      }
      <div
        className="flex items-end space-x-2"
        style={{
          height: `${height}px`
        }}>

        {data.map((item, index) =>
        <div key={index} className="flex-1 flex flex-col items-center group">
            <div className="relative w-full flex items-end justify-center">
              <div
              className={`w-full max-w-[40px] rounded-t-md transition-all duration-500 ${item.color || 'bg-blue-500'} group-hover:opacity-80`}
              style={{
                height: `${item.value / maxValue * 100}%`
              }}>

                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                  {item.value}
                </div>
              </div>
            </div>
            <span className="text-xs text-slate-500 mt-2 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        )}
      </div>
    </div>);

}