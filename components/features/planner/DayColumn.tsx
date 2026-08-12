import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { DAYS } from '../../../lib/constants';
import { useDayItems, usePlannerStore } from '../../../hooks/usePlannerStore';
import { DayNotes } from './DayNotes';
import { ScheduledCard } from './ScheduledCard';
import { WeatherPill } from './WeatherPill';
import { useWeather } from '../../../hooks/useWeather';
import { getMonday, dayIndex, formatDateLocal } from '../../../lib/dates';
import styles from './DayColumn.module.scss';

export function DayColumn({ day, week }: { day: typeof DAYS[number]; week: 1 | 2 }) {
  const items = useDayItems(day, week);
  const itemIds = items.map(item => item.id);
  
  const { data: weather } = useWeather();
  const lastViewedMonday = usePlannerStore(s => s.lastViewedMonday);

  let weatherPill = null;
  if (week === 1 && weather && weather.days.length > 0) {
    const monday = lastViewedMonday ? new Date(lastViewedMonday) : getMonday(new Date());
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + dayIndex(day));
    const dayStr = formatDateLocal(dayDate);
    const dayWeather = weather.days.find(d => d.date === dayStr);
    
    if (dayWeather) {
      weatherPill = <WeatherPill code={dayWeather.code} tempMax={dayWeather.tempMax} unit={weather.unit} />;
    }
  }

  const { setNodeRef, isOver } = useDroppable({
    id: `col-${week}-${day}`,
    data: { kind: 'column', day, week },
  });

  return (
    <div 
      className={clsx(styles.column, isOver && styles.isOver)}
      ref={setNodeRef}
    >
      <div className={styles.header}>
        <span className={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
        <div className={styles.weatherPlaceholder}>{weatherPill}</div>
      </div>
      <DayNotes day={day} week={week} />
      <div className={styles.itemsList}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <ScheduledCard key={item.id} item={item} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}