import React, { useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ActivitySchema, Activity } from '@/lib/types';
import { Modal } from '@/components/elements/Modal/Modal';
import { Tabs, TabConfig } from '@/components/elements/Tabs/Tabs';
import { TextInput } from '@/components/elements/TextInput/TextInput';
import { NumberInput } from '@/components/elements/NumberInput/NumberInput';
import { Select } from '@/components/elements/Select/Select';
import { Checkbox } from '@/components/elements/Checkbox/Checkbox';
import { Button } from '@/components/elements/Button/Button';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { ColorPicker } from '@/components/elements/ColorPicker/ColorPicker';
import { IconPicker } from '@/components/elements/IconPicker/IconPicker';
import { TagInput } from '@/components/elements/TagInput/TagInput';
import { MdDelete, MdAdd } from 'react-icons/md';
import { StravaSportPicker } from './StravaSportPicker/StravaSportPicker';
import styles from './ActivityFormModal.module.scss';
import { usePlannerStore } from '@/lib/store';
import { formatPaceMinutes, parsePaceMinutes } from '@/lib/schedule';
import { DEFAULT_SPORTS_BY_ICON } from '@/lib/stravaSports';

export interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity?: Activity;
  /**
   * The week being edited, when this modal was opened from a week's rail. The
   * activity then belongs to that week alone: it is never written back to "My
   * activities", which is only the template a week can be built from. Without
   * it, the modal edits the template and no week moves.
   */
  weekStart?: string;
}

const TABS: TabConfig[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'types', label: 'Workout types' },
  { id: 'strava', label: 'Strava' },
  { id: 'links', label: 'Links' },
  { id: 'appearance', label: 'Appearance' }
];

/** Falls back to the violet preset so a new workout starts on the theme colour. */
const DEFAULT_ACTIVITY_COLOR = '#8E4EC6';

/** Lets the footer's submit button reach the form it sits outside of. */
const FORM_ID = 'activity-form';

export const ActivityFormModal: React.FC<ActivityFormModalProps> = ({ isOpen, onClose, activity, weekStart }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const addActivity = usePlannerStore((s) => s.addActivity);
  const updateActivity = usePlannerStore((s) => s.updateActivity);
  const addWeekActivity = usePlannerStore((s) => s.addWeekActivity);
  const updateWeekActivity = usePlannerStore((s) => s.updateWeekActivity);
  
  const { control, handleSubmit, reset, register, setValue, formState: { errors } } = useForm<Activity>({
    resolver: zodResolver(ActivitySchema),
    defaultValues: activity || {
      id: '',
      name: '',
      icon: 'run',
      metric: 'distance',
      unit: 'miles',
      target: 0,
      color: DEFAULT_ACTIVITY_COLOR,
      optional: false,
      paceMinutes: null,
      paceDistance: null,
      typicalDurationMinutes: null,
      workoutTypes: [],
      stravaSportTypes: [...(DEFAULT_SPORTS_BY_ICON.run ?? [])],
      links: []
    }
  });

  const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
    control,
    name: 'links'
  });

  const metric = useWatch({ control, name: 'metric' });
  const icon = useWatch({ control, name: 'icon' });
  const unit = useWatch({ control, name: 'unit' });
  const isOptional = useWatch({ control, name: 'optional' });

  // Pace is entered, stored and read back as a minutes/distance pair — "2:00 /
  // 100 yards" — so it keeps the shape a pace is spoken in. These two live
  // outside react-hook-form only because the minutes half is typed as a clock
  // split; both halves are saved.
  const [paceMinutesInput, setPaceMinutesInput] = useState('');
  const [paceDistanceInput, setPaceDistanceInput] = useState<number | ''>(1);

  /**
   * Once the sports have been chosen by hand they are the user's, and changing
   * the icon must not quietly rewrite them. Until then the icon is the only
   * signal we have, so switching it re-seeds the suggestion.
   */
  const [hasChosenSports, setHasChosenSports] = useState(false);
  /** The icon as it was last seen, so opening the modal does not read as a change. */
  const lastIconRef = useRef<string | null>(null);

  useEffect(() => {
    if (!icon) return;
    const previous = lastIconRef.current;
    lastIconRef.current = icon;
    if (previous === null || previous === icon || hasChosenSports) return;
    setValue('stravaSportTypes', [...(DEFAULT_SPORTS_BY_ICON[icon] ?? [])]);
  }, [icon, hasChosenSports, setValue]);

  useEffect(() => {
    if (metric === 'instance') {
      setValue('unit', 'sessions');
    }
    if (metric === 'duration') {
      setValue('unit', 'mins');
    }
    // Only one of the two typical-length inputs is ever on screen; drop the
    // other so a metric switch cannot leave a stale estimate behind it.
    if (metric !== 'distance') {
      setValue('paceMinutes', null);
      setValue('paceDistance', null);
    }
    if (metric !== 'instance') setValue('typicalDurationMinutes', null);
  }, [metric, setValue]);

  useEffect(() => {
    if (metric !== 'distance') return;
    const minutes = parsePaceMinutes(paceMinutesInput);
    if (minutes === null || paceDistanceInput === '' || Number(paceDistanceInput) <= 0) {
      setValue('paceMinutes', null);
      setValue('paceDistance', null);
    } else {
      setValue('paceMinutes', minutes);
      setValue('paceDistance', Number(paceDistanceInput));
    }
  }, [paceMinutesInput, paceDistanceInput, metric, setValue]);

  // An optional workout has no weekly target; drop any value carried over from
  // before the box was ticked so nothing stale gets saved.
  useEffect(() => {
    if (isOptional) {
      setValue('target', null);
    }
  }, [isOptional, setValue]);

  useEffect(() => {
    if (isOpen) {
      if (activity) {
        reset(activity);
        // Both halves come back exactly as they were typed.
        setPaceMinutesInput(activity.paceMinutes != null ? formatPaceMinutes(activity.paceMinutes) : '');
        setPaceDistanceInput(activity.paceDistance ?? 1);
      } else {
        reset({
          id: `type-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: '',
          icon: 'run',
          metric: 'distance',
          unit: 'miles',
          target: 0,
          color: DEFAULT_ACTIVITY_COLOR,
          optional: false,
          paceMinutes: null,
          paceDistance: null,
          typicalDurationMinutes: null,
          workoutTypes: [],
          stravaSportTypes: [...(DEFAULT_SPORTS_BY_ICON.run ?? [])],
          links: []
        });
        setPaceMinutesInput('');
        setPaceDistanceInput(1);
      }
      // A fresh open is not an icon change, and the saved sports are whatever
      // the activity already holds.
      lastIconRef.current = null;
      setHasChosenSports(Boolean(activity?.stravaSportTypes?.length));
      setTimeout(() => {
        setActiveTab('basic');
      }, 0);
    }
  }, [isOpen, activity, reset]);

  const onSubmit = (data: Activity) => {
    if (weekStart) {
      // Opened from a week: this activity is that week's, start to finish.
      if (activity) updateWeekActivity(weekStart, activity.id, data);
      else addWeekActivity(weekStart, data);
    } else if (activity) {
      updateActivity(activity.id, data);
    } else {
      addActivity(data);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activity ? 'Edit activity' : 'Add activity'}
      maxWidth="600px"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary">Save</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        
        <div className={styles.tabContent}>
          {activeTab === 'basic' && (
            <div className={styles.section}>
              <TextInput
                label="Activity name"
                {...register('name')}
                error={errors.name?.message}
                placeholder="e.g. Running, Lifting"
              />
              <Controller
                control={control}
                name="optional"
                render={({ field }) => (
                  <Checkbox
                    label="Optional (does not count towards weekly progress)"
                    checked={field.value ?? false}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className={styles.row}>
                <Select label="Metric" {...register('metric')} error={errors.metric?.message}>
                  <option value="distance">Distance</option>
                  <option value="duration">Duration</option>
                  <option value="instance">Sessions</option>
                </Select>
                {metric === 'distance' && (
                  <TextInput label="Unit" {...register('unit')} error={errors.unit?.message} placeholder="e.g. miles" />
                )}
              </div>
              {!isOptional && (
                <Controller
                  control={control}
                  name="target"
                  render={({ field }) => (
                    <NumberInput
                      label={metric === 'duration' ? 'Weekly target (minutes)' : 'Weekly target'}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        field.onChange(raw === '' ? null : Number(raw));
                      }}
                      error={errors.target?.message}
                    />
                  )}
                />
              )}
              {metric === 'instance' && (
                <div className={styles.field}>
                  <Controller
                    control={control}
                    name="typicalDurationMinutes"
                    render={({ field }) => (
                      <NumberInput
                        label="Typical session duration (mins)"
                        value={field.value ?? ''}
                        step={15}
                        min={0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          field.onChange(raw === '' ? null : Number(raw));
                        }}
                        error={errors.typicalDurationMinutes?.message}
                      />
                    )}
                  />
                  <p className={styles.hint}>How long each session blocks out on the calendar by default.</p>
                </div>
              )}
              {metric === 'distance' && (
                <div className={styles.field}>
                  <div className={styles.row}>
                    <TextInput
                      label="Typical pace: minutes"
                      value={paceMinutesInput}
                      placeholder="7:30"
                      inputMode="numeric"
                      onChange={(e) => setPaceMinutesInput(e.target.value)}
                      error={errors.paceMinutes?.message}
                    />
                    <NumberInput
                      label={`/ ${unit || 'unit'}`}
                      value={paceDistanceInput}
                      step="any"
                      min={0}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setPaceDistanceInput(raw === '' ? '' : Number(raw));
                      }}
                    />
                  </div>
                  <p className={styles.hint}>Used to estimate activity duration.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'types' && (
            <div className={styles.section}>
              <p className={styles.hint}>Add sub-types of workouts for this workout to classify your sessions.</p>
              <Controller
                control={control}
                name="workoutTypes"
                render={({ field }) => (
                  <TagInput
                    tags={field.value || []}
                    onChange={field.onChange}
                    placeholder="e.g. Long Run, Recovery"
                  />
                )}
              />
            </div>
          )}

          {activeTab === 'strava' && (
            <div className={styles.section}>
              <p className={styles.hint}>
                Which Strava recordings count as this activity. A recording lands on
                whatever you planned that day of an activity that accepts its sport, so
                two activities can share one — a long run and an easy run are both
                &quot;Run&quot; to Strava, and the day tells them apart.
              </p>
              <Controller
                control={control}
                name="stravaSportTypes"
                render={({ field }) => (
                  <StravaSportPicker
                    value={field.value ?? []}
                    onChange={(value) => {
                      setHasChosenSports(true);
                      field.onChange(value);
                    }}
                  />
                )}
              />
            </div>
          )}

          {activeTab === 'links' && (
            <div className={styles.section}>
              <p className={styles.hint}>Add links related to this activity.</p>
              <div className={styles.linksList}>
                {linkFields.map((field, index) => (
                  <div key={field.id} className={styles.linkRow}>
                    <TextInput placeholder="Link title" {...register(`links.${index}.title` as const)} />
                    <TextInput placeholder="URL" {...register(`links.${index}.url` as const)} />
                    <IconButton type="button" variant="danger" onClick={() => removeLink(index)}>
                      <MdDelete />
                    </IconButton>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                className={styles.addLink}
                onClick={() => appendLink({ id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, title: '', url: '' })}
              >
                <MdAdd /> Add link
              </Button>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className={styles.section}>
              <div className={styles.field}>
                <label>Color</label>
                <Controller
                  control={control}
                  name="color"
                  render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
                />
              </div>
              <div className={styles.field}>
                <label>Icon</label>
                <Controller
                  control={control}
                  name="icon"
                  render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
