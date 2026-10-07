import React from "react";

const STATS = [
  { value: "50+", label: "Active partners" },
  { value: "8", label: "Partner categories" },
  { value: "NCR-wide", label: "Coverage area" },
  { value: "GST-ready", label: "Billing & contracts" },
];

export default function PartnerStatsBar() {
  return (
    <div className="bg-[#111111] text-white py-8 border-y border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-gray-800">
          {STATS.map((stat, idx) => (
            <div key={idx} className="pt-4 md:pt-0 first:pt-0 flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#FE6700] tracking-tight mb-1">
                {stat.value}
              </span>
              <span className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
