import React, { useState } from 'react';
interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}
interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}
export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  return (
    <div className="w-full">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id ? 'border-[#0563bb] text-[#0563bb]' : 'border-transparent text-slate-500 hover:text-[#0563bb] hover:border-[#57c84d]'}
              `}>

              {tab.label}
            </button>
          )}
        </nav>
      </div>
      <div className="mt-6">
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </div>);

}
