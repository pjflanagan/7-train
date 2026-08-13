'use client';

import React, { useState } from 'react';
import { MdDelete } from 'react-icons/md';
import { usePlannerStore } from '@/lib/store';
import { useLinks } from '@/hooks/usePlannerSelectors';
import { Modal } from '@/components/elements/Modal/Modal';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { Button } from '@/components/elements/Button/Button';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { TextInput } from '@/components/elements/TextInput/TextInput';
import { HelpfulLink } from '@/lib/types';
import styles from './LinksModal.module.scss';

export interface LinksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LinksModal: React.FC<LinksModalProps> = ({ isOpen, onClose }) => {
  const links = useLinks();
  const addLink = usePlannerStore((state) => state.addLink);
  const removeLink = usePlannerStore((state) => state.removeLink);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  
  const [linkToDelete, setLinkToDelete] = useState<HelpfulLink | null>(null);

  const handleAdd = () => {
    if (!title.trim() || !url.trim()) return;
    
    // Auto-prepend https:// if missing and doesn't start with http
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    addLink({
      id: 'link-' + Date.now(),
      title: title.trim(),
      url: finalUrl
    });
    
    setTitle('');
    setUrl('');
  };

  const handleConfirmDelete = () => {
    if (linkToDelete) {
      removeLink(linkToDelete.id);
      setLinkToDelete(null);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Bookmarks" maxWidth="400px">
        <div className={styles.container}>
          <div className={styles.list}>
            {links.length === 0 ? (
              <div className={styles.empty}>No links stored yet. Add one below!</div>
            ) : (
              links.map(link => (
                <div key={link.id} className={styles.linkRow}>
                  <div className={styles.linkInfo}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className={styles.linkTitle}>
                      {link.title}
                    </a>
                    <span className={styles.linkUrl}>{link.url}</span>
                  </div>
                  <IconButton 
                    onClick={() => setLinkToDelete(link)}
                    aria-label={`Delete ${link.title}`}
                    variant="danger"
                  >
                    <MdDelete />
                  </IconButton>
                </div>
              ))
            )}
          </div>

          <div className={styles.addForm}>
            <p className={styles.formTitle}>Add a link</p>
            <div className={styles.inputs}>
              <TextInput 
                placeholder="Link title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
              />
              <TextInput 
                placeholder="URL" 
                value={url} 
                onChange={(e) => setUrl(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
              />
            </div>
            <Button
              variant="primary"
              className={styles.addButton}
              onClick={handleAdd}
              disabled={!title.trim() || !url.trim()}
            >
              Add link
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!linkToDelete}
        title="Delete link"
        message={`Are you sure you want to delete "${linkToDelete?.title}"?`}
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setLinkToDelete(null)}
      />
    </>
  );
};
