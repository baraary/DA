import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  compact?: boolean;
  handleTitle?: string;
}

export const SortableItem: React.FC<SortableItemProps> = ({
  id,
  children,
  disabled = false,
  compact = false,
  handleTitle = 'جابه‌جایی و تغییر ترتیب (بکشید و رها کنید)',
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group transition-shadow ${
        isDragging
          ? 'opacity-90 shadow-xl ring-2 ring-sky-500/70 rounded-xl bg-white dark:bg-slate-900'
          : ''
      }`}
    >
      <div className={`flex items-stretch ${compact ? 'gap-1' : 'gap-2'}`}>
        {!disabled && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            title={handleTitle}
            aria-label={handleTitle}
            className={`touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              compact ? 'px-0.5' : 'px-1.5'
            }`}
          >
            <GripVertical className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </button>
        )}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
};
