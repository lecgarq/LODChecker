import { useCallback, useState } from 'react';
import { deleteImage } from '@/services/api';

export function useNodeDeletion(onDeleteNode: (id: string) => void, onClose: () => void) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const confirmDelete = useCallback(async (id: string, imgPath?: string) => {
    setIsDeleting(true);
    try {
      const filename = (imgPath || '').split('/').pop() || id;
      const res = await deleteImage(filename);
      if (res.ok) {
        onDeleteNode(id);
        onClose();
        setShowConfirm(false);
      } else {
        alert('Failed to delete image.');
      }
    } catch (error) {
      console.error(error);
      alert('Error deleting image.');
    } finally {
      setIsDeleting(false);
    }
  }, [onClose, onDeleteNode]);

  return { isDeleting, showConfirm, setShowConfirm, confirmDelete };
}
