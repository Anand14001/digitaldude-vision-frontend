import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiUpload, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fileSize, fmtDate } from '@/lib/utils';
import type { FileObject } from '@/types/api';
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, Spinner } from '@/components/ui';

const iconFor = (mime: string) => {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return Film;
  if (mime.startsWith('audio/')) return Music;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') {
    return FileSpreadsheet;
  }
  if (mime === 'application/pdf' || mime.includes('word') || mime.startsWith('text/')) {
    return FileText;
  }
  return FileIcon;
};

/**
 * Attachment list with drag-and-drop upload, used on projects, tasks and
 * clients. Uploads go through the API, which validates type and size before
 * handing the file to the storage provider.
 */
export function FileList({
  projectId,
  taskId,
  clientId,
  folder = 'misc',
  title = 'Files',
}: {
  projectId?: string;
  taskId?: string;
  clientId?: string;
  folder?: 'avatars' | 'logos' | 'documents' | 'deliverables' | 'tasks' | 'misc';
  title?: string;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<FileObject | null>(null);

  const scope = { projectId, taskId, clientId };
  const queryKey = ['files', scope];

  const { data: files, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiGet<FileObject[]>('/files', scope),
    enabled: Boolean(projectId || taskId || clientId),
  });

  const upload = useMutation({
    mutationFn: (selected: File[]) =>
      apiUpload<FileObject[]>(
        '/files',
        selected,
        Object.fromEntries(
          Object.entries({ ...scope, folder }).filter(([, value]) => Boolean(value)),
        ) as Record<string, string>,
      ),
    onSuccess: (created) => {
      toast.success(`${created.length} file${created.length === 1 ? '' : 's'} uploaded`);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/files/${id}`),
    onSuccess: () => {
      toast.success('File deleted');
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    upload.mutate(Array.from(list).slice(0, 10));
  };

  return (
    <Card>
      <CardHeader
        title={title}
        description="Up to 50 MB per file"
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={<Upload className="h-3.5 w-3.5" />}
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            Upload
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onFiles(event.dataTransfer.files);
        }}
        className={cn('transition-colors', dragOver && 'bg-primary-soft')}
      >
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : files?.length === 0 ? (
          <EmptyState
            compact
            icon={<Upload className="h-5 w-5" />}
            title={dragOver ? 'Drop to upload' : 'No files yet'}
            description="Drag files here or use the upload button."
          />
        ) : (
          <ul className="divide-y divide-border">
            {files?.map((file) => {
              const Icon = iconFor(file.mimeType);
              const isImage = file.mimeType.startsWith('image/');
              return (
                <li key={file.id} className="group flex items-center gap-3 px-5 py-3">
                  {isImage ? (
                    <img
                      src={file.url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                  )}
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-sm font-medium text-fg hover:underline">
                      {file.originalName}
                    </span>
                    <span className="block text-2xs text-muted">
                      {fileSize(file.sizeBytes)}
                      {file.uploadedBy ? ` · ${file.uploadedBy.name}` : ''}
                      {file.createdAt ? ` · ${fmtDate(file.createdAt)}` : ''}
                    </span>
                  </a>
                  {(file.uploadedBy?.id === user?.id || user?.role?.isAdmin) && (
                    <button
                      type="button"
                      onClick={() => setDeleting(file)}
                      aria-label="Delete file"
                      className="hidden shrink-0 rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="Delete this file?"
        message={`"${deleting?.originalName}" will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </Card>
  );
}
