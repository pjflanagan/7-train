import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { useDayItems, useWeekStartsOn } from '@/hooks/usePlannerSelectors';
import { DayNotes } from './DayNotes';
import { ScheduledCard } from './ScheduledCard';
import { WeatherPill } from './WeatherPill';
import { useWeather } from '@/hooks/useWeather';
import { dateForDay, formatDateLocal } from '@/lib/dates';
import styles from './DayColumn.module.scss';

export interface DayColumnProps {
  day: typeof DAYS[number];
  weekStart: string;
  isToday?: boolean;
}

export function DayColumn({ day, weekStart, isToday }: DayColumnProps) {
  const items = useDayItems(day, weekStart);
  const itemIds = items.map(item => item.id);
  const weekStartsOn = useWeekStartsOn();

  const { data: weather } = useWeather();

  const dayDate = dateForDay(weekStart, day, weekStartsOn);
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
    id: `col-${weekStart}-${day}`,
    data: { kind: 'column', day, weekStart },
  });

  return (
    <div
      className={clsx(styles.column, isOver && styles.isOver, isToday && styles.isToday)}
      ref={setNodeRef}
    >
      <div className={styles.header}>
        <span className={styles.dayName}>{day.slice(0, 3).toUpperCase()} {dayOfMonth}</span>
        {weatherPill}
      </div>
      <DayNotes day={day} weekStart={weekStart} />
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
