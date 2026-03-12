import { CheckCircle, XCircle, HelpCircle, Leaf } from 'lucide-react';
import { Fountain } from '../types';

export function PotabilityBadge({ fountain, t }: { fountain: Fountain, t: any }) {
  if (fountain.type === 'natural') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
        <Leaf className="w-4 h-4" />
        {t.naturalSpring}
      </span>
    );
  }
  
  if (fountain.potable === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle className="w-4 h-4" />
        {t.potableYes}
      </span>
    );
  }
  
  if (fountain.potable === 'no') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
        <XCircle className="w-4 h-4" />
        {t.potableNo}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-200">
      <HelpCircle className="w-4 h-4" />
      {t.potableUnknown}
    </span>
  );
}
