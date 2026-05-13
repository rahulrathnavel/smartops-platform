import React from 'react';

const StatusBadge = ({ status, text }) => {
  let bgColor, textColor, dotColor;

  switch (status.toUpperCase()) {
    case 'CONNECTED':
    case 'RUNNING':
    case 'READY':
    case 'SUCCESS':
    case 'TRUE':
      bgColor = 'bg-emerald-500/10';
      textColor = 'text-emerald-400';
      dotColor = 'bg-emerald-500';
      break;
    case 'DISCONNECTED':
    case 'FAILED':
    case 'ERROR':
    case 'FALSE':
    case 'NOTREADY':
      bgColor = 'bg-rose-500/10';
      textColor = 'text-rose-400';
      dotColor = 'bg-rose-500';
      break;
    case 'PENDING':
    case 'WARNING':
      bgColor = 'bg-amber-500/10';
      textColor = 'text-amber-400';
      dotColor = 'bg-amber-500';
      break;
    default:
      bgColor = 'bg-slate-500/10';
      textColor = 'text-slate-400';
      dotColor = 'bg-slate-500';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${bgColor} ${textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shadow-[0_0_8px_currentColor]`}></span>
      {text || status}
    </span>
  );
};

export default StatusBadge;
