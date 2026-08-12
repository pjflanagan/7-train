'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { MdClose } from 'react-icons/md';
import styles from './TagInput.module.scss';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add a tag...',
  className
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !tags.includes(val)) {
        onChange([...tags, val]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className={clsx(styles.container, className)}>
      {tags.map(tag => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => removeTag(tag)}
            aria-label={`Remove ${tag}`}
          >
            <MdClose size={14} />
          </button>
        </span>
      ))}
      <input
        type="text"
        className={styles.input}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
      />
    </div>
  );
};