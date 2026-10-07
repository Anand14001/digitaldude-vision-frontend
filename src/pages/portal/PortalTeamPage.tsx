import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Star } from 'lucide-react';
import { apiGet, errorMessage } from '@/lib/api';
import type { ClientContact } from '@/types/api';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from '@/components/ui';

interface PortalTeam {
  contacts: ClientContact[];
  agencyTeam: {
    name: string;
    avatarUrl: string | null;
    designation: string | null;
    isLead: boolean;
    roles: string[];
  }[];
}

/** Who is who: the client's own contacts and the Digital Dude people on their work. */
export function PortalTeamPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'team'],
    queryFn: () => apiGet<PortalTeam>('/portal/team'),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Contacts</h1>
        <p className="mt-1 text-sm text-muted">
          The people on both sides of your projects.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your Digital Dude team" description="Working on your projects now" />
          {data?.agencyTeam.length === 0 ? (
            <EmptyState compact title="No one assigned yet" />
          ) : (
            <ul className="divide-y divide-border">
              {data?.agencyTeam.map((person) => (
                <li key={person.name} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{person.name}</p>
                    <p className="truncate text-2xs text-muted">
                      {person.designation ?? 'Digital Dude'}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    {person.isLead && <Badge tone="primary">Lead</Badge>}
                    {person.roles.map((role) => (
                      <Badge key={role} tone="neutral">
                        {role}
                      </Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Your contacts" description="People we have on file at your end" />
          <ul className="divide-y divide-border">
            {data?.contacts.map((contact) => (
              <li key={contact.id} className="flex items-start gap-3 px-5 py-3">
                <Avatar name={contact.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
                    {contact.name}
                    {contact.isPrimary && <Star className="h-3 w-3 fill-warning text-warning" />}
                  </p>
                  <p className="truncate text-2xs text-muted">
                    {contact.designation ?? 'Contact'}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1.5 text-muted hover:text-primary"
                    >
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </a>
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1.5 text-muted hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    )}
                  </div>
                </div>
                {contact.portalEnabled && (
                  <Badge tone="success">
                    {contact.canApprove ? 'Portal + approvals' : 'Portal access'}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
