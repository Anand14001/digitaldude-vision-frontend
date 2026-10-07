import { useQuery } from '@tanstack/react-query';
import { FolderOpen } from 'lucide-react';
import { apiGet, errorMessage } from '@/lib/api';
import { fileSize, fmtDate } from '@/lib/utils';
import type { FileObject } from '@/types/api';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from '@/components/ui';

/** Everything the agency has shared with this client, newest first. */
export function PortalFilesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'files'],
    queryFn: () => apiGet<FileObject[]>('/portal/files'),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Files</h1>
        <p className="mt-1 text-sm text-muted">
          Approved deliverables and anything else shared with you.
        </p>
      </header>

      <Card>
        <CardHeader title="Shared with you" description={`${data?.length ?? 0} files`} />
        {data?.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-5 w-5" />}
            title="No files yet"
            description="Files appear here once we share a deliverable with you."
          />
        ) : (
          <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((file) => (
              <li key={file.id}>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-border transition-shadow hover:shadow-pop"
                >
                  {file.mimeType.startsWith('image/') ? (
                    <img src={file.url} alt="" className="h-36 w-full object-cover" />
                  ) : file.mimeType.startsWith('video/') ? (
                    <video src={file.url} className="h-36 w-full bg-black object-cover" controls />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-surface-2 text-sm font-semibold text-muted">
                      {file.originalName.split('.').pop()?.toUpperCase()}
                    </div>
                  )}
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-fg">{file.originalName}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-2xs text-subtle">
                      {fileSize(file.sizeBytes)}
                      {file.createdAt ? ` · ${fmtDate(file.createdAt)}` : ''}
                    </p>
                    {file.project && (
                      <Badge tone="neutral" className="mt-1.5">
                        {file.project.name}
                      </Badge>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
