import React, { useEffect, useState } from 'react';
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
import styles from './ActivityFormModal.module.scss';
import { usePlannerStore } from '@/lib/store';
import { formatPaceMinutes, parsePaceMinutes } from '@/lib/schedule';

export interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity?: Activity;
}

const TABS: TabConfig[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'types', label: 'Workout types' },
  { id: 'links', label: 'Links' },
  { id: 'appearance', label: 'Appearance' }
];

/** Falls back to the violet preset so a new workout starts on the theme colour. */
const DEFAULT_ACTIVITY_COLOR = '#8E4EC6';

/** Lets the footer's submit button reach the form it sits outside of. */
const FORM_ID = 'activity-form';

export const ActivityFormModal: React.FC<ActivityFormModalProps> = ({ isOpen, onClose, activity }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const addActivity = usePlannerStore((s) => s.addActivity);
  const updateActivity = usePlannerStore((s) => s.updateActivity);
  
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
      typicalDurationMinutes: null,
      workoutTypes: [],
      links: []
    }
  });

  const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
    control,
    name: 'links'
  });

  const metric = useWatch({ control, name: 'metric' });
  const unit = useWatch({ control, name: 'unit' });
  const isOptional = useWatch({ control, name: 'optional' });

  // Pace is entered as a minutes/distance ratio — e.g. "9 minutes / 1 mile" —
  // rather than the single per-unit number the form actually saves, so it
  // reads the way a pace is normally spoken. These two live outside
  // react-hook-form and only ever get collapsed into `paceMinutes`.
  const [paceMinutesInput, setPaceMinutesInput] = useState('');
  const [paceDistanceInput, setPaceDistanceInput] = useState<number | ''>(1);

  useEffect(() => {
    if (metric === 'times') {
      setValue('unit', 'times');
    }
    // Only one of the two typical-length inputs is ever on screen; drop the
    // other so a metric switch cannot leave a stale estimate behind it.
    if (metric !== 'distance') setValue('paceMinutes', null);
    if (metric !== 'times') setValue('typicalDurationMinutes', null);
  }, [metric, setValue]);

  useEffect(() => {
    if (metric !== 'distance') return;
    const minutes = parsePaceMinutes(paceMinutesInput);
    if (minutes === null || paceDistanceInput === '' || Number(paceDistanceInput) <= 0) {
      setValue('paceMinutes', null);
    } else {
      setValue('paceMinutes', minutes / Number(paceDistanceInput));
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
        // The stored ratio is minutes-per-one-unit, so that's the only pair
        // that reconstructs it without inventing a distance the user never gave.
        setPaceMinutesInput(activity.paceMinutes != null ? formatPaceMinutes(activity.paceMinutes) : '');
        setPaceDistanceInput(1);
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
          typicalDurationMinutes: null,
          workoutTypes: [],
          links: []
        });
        setPaceMinutesInput('');
        setPaceDistanceInput(1);
      }
      setTimeout(() => {
        setActiveTab('basic');
      }, 0);
    }
  }, [isOpen, activity, reset]);

  const onSubmit = (data: Activity) => {
    if (activity) {
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
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className={styles.row}>
                <Select label="Metric" {...register('metric')} error={errors.metric?.message}>
                  <option value="distance">Distance</option>
                  <option value="duration">Duration</option>
                  <option value="times">Times</option>
                </Select>
                {metric !== 'times' && (
                  <TextInput label="Unit" {...register('unit')} error={errors.unit?.message} placeholder="e.g. miles, mins" />
                )}
              </div>
              {!isOptional && (
                <Controller
                  control={control}
                  name="target"
                  render={({ field }) => (
                    <NumberInput
                      label="Weekly target"
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
              {metric === 'times' && (
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
