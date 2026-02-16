import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteActionProps {
  isDeleting: boolean;
  showConfirm: boolean;
  onConfirm: () => void;
  onShowConfirm: (show: boolean) => void;
}

export default function DeleteAction({
  isDeleting,
  showConfirm,
  onConfirm,
  onShowConfirm,
}: DeleteActionProps) {
  return (
    <div className="mt-12 mb-4">
      {showConfirm ? (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 animate-fade-in">
          <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
            <AlertTriangle size={16} />
            <span className="text-sm">Confirm Deletion?</span>
          </div>
          <p className="text-xs text-red-500/80 mb-3 font-medium">This is permanent. Image and data will be removed.</p>
          <div className="flex gap-2">
            <button
              onClick={() => onShowConfirm(false)}
              className="flex-1 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onShowConfirm(true)}
          className="w-full flex items-center justify-center gap-2 p-3 text-red-400 font-bold text-xs bg-red-50/10 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-300 border border-transparent hover:border-red-100 group"
        >
          <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
          Delete Image
        </button>
      )}
    </div>
  );
}
