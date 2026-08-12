import { useCallback } from 'react';
import { usePlannerStore } from '../lib/store';
import { exportCsv } from '../lib/csv';

export function useCsvExport() {
  const history = usePlannerStore(state => state.history);
  const goals = usePlannerStore(state => state.goals);

  const exportData = useCallback(() => {
    const csvContent = exportCsv(history, goals);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `workout_history_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [history, goals]);

  return { exportData };
}
