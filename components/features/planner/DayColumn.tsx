import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useDayItems } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { DayNotes } from './DayNotes';
import { ScheduledCard } from './ScheduledCard';
import { WeatherPill } from './WeatherPill';
import { useWeather } from '@/hooks/useWeather';
import { getMonday, dayIndex, formatDateLocal } from '@/lib/dates';
import styles from './DayColumn.module.scss';

export function DayColumn({ day, week }: { day: typeof DAYS[number]; week: 1 | 2 }) {
  const items = useDayItems(day, week);
  const itemIds = items.map(item => item.id);
  
  const { data: weather } = useWeather();
  const lastViewedMonday = usePlannerStore(s => s.lastViewedMonday);

  const monday = lastViewedMonday ? new Date(lastViewedMonday) : getMonday(new Date());
  const dayDate = new Date(monday);
  const daysToAdd = dayIndex(day) + (week - 1) * 7;
  dayDate.setDate(monday.getDate() + daysToAdd);
  const dayOfMonth = dayDate.getDate();

  let weatherPill = null;
  if (weather && weather.days.length > 0) {
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
        <span className={styles.dayName}>{day.slice(0, 3).toUpperCase()} {dayOfMonth}</span>
        {weatherPill}
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