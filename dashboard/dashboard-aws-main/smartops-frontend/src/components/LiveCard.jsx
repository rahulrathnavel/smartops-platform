import React from 'react';

const LiveCard = ({ title, value, unit, icon: Icon, trend }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-slate-400 font-medium text-sm tracking-wide uppercase">{title}</h3>
        {Icon && <Icon className="w-5 h-5 text-blue-400" />}
      </div>
      
      <div className="flex items-baseline gap-2 relative z-10">
        <span className="text-3xl font-bold text-white">{value}</span>
        {unit && <span className="text-slate-400 font-medium">{unit}</span>}
      </div>
      
      {trend && (
        <div className="mt-4 relative z-10">
          <span className={`text-sm font-medium ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400'}`}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'} Live
          </span>
        </div>
      )}
    </div>
  );
};

export default LiveCard;
