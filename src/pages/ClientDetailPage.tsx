import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ExternalLink,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  ShieldOff,
  Star,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtCurrency, fmtDate, humanise } from '@/lib/utils';
import type { ClientContact, ClientDetail } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FieldGrid,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@/components/ui';
import {
  ClientStatusBadge,
  HealthBadge,
  ProjectStatusBadge,
  RetainerStatusBadge,
} from '@/components/domain';
import { CommentThread } from '@/features/CommentThread';
import { FileList } from '@/features/FileList';

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState('overview');
  const [addingContact, setAddingContact] = useState(false);
  const [grantingPortal, setGrantingPortal] = useState<ClientContact | null>(null);
  const [revoking, setRevoking] = useState<ClientContact | null>(null);

  const { data: client, isLoading, error, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn: () => apiGet<ClientDetail>(`/clients/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!client) return null;

  const portalUsers = client.contacts.filter((contact) => contact.portalEnabled);

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to="/clients" className="hover:text-fg">
            Clients
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {client.logo ? (
              <img
                src={client.logo.url}
                alt=""
                className="h-9 w-9 rounded-lg object-cover ring-1 ring-border"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Building2 className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              </span>
            )}
            {client.name}
          </span>
        }
        description={[client.industry, client.city].filter(Boolean).join(' · ')}
        meta={
          <>
            <ClientStatusBadge value={client.status} />
            {client.serviceLines.map((entry) => (
              <Badge key={entry.serviceLine.id} tone="neutral">
                {entry.serviceLine.name}
              </Badge>
            ))}
            {portalUsers.length > 0 && (
              <Badge tone="info">
                {portalUsers.length} portal user{portalUsers.length === 1 ? '' : 's'}
              </Badge>
            )}
          </>
        }
        actions={
          can('clients.contacts.manage') ? (
            <Button
              icon={<UserPlus className="h-4 w-4" />}
              variant="secondary"
              onClick={() => setAddingContact(true)}
            >
              Add contact
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="projects" count={client.projects.length}>
            Projects
          </Tab>
          <Tab value="retainers" count={client.retainers.length}>
            Retainers
          </Tab>
          <Tab value="contacts" count={client.contacts.length}>
            Contacts
          </Tab>
          <Tab value="files">Files</Tab>
          <Tab value="notes">Notes</Tab>
        </TabList>

        <TabPanel value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Account details" />
              <div className="px-5 py-4">
                <FieldGrid>
                  <Field label="Legal name">{client.legalName}</Field>
                  <Field label="GSTIN">{client.gstin}</Field>
                  <Field label="Email">
                    {client.email ? (
                      <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                        {client.email}
                      </a>
                    ) : null}
                  </Field>
                  <Field label="Phone">{client.phone}</Field>
                  <Field label="Website">
                    {client.website ? (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {client.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </Field>
                  <Field label="Account manager">{client.accountManager?.user.name}</Field>
                  <Field label="Address">
                    {[client.addressLine, client.city, client.state, client.pincode]
                      .filter(Boolean)
                      .join(', ') || null}
                  </Field>
                  <Field label="Client since">{fmtDate(client.onboardedAt)}</Field>
                </FieldGrid>
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Primary contact" />
                {client.contacts.find((contact) => contact.isPrimary) ? (
                  (() => {
                    const primary = client.contacts.find((contact) => contact.isPrimary) as ClientContact;
                    return (
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={primary.name} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-fg">{primary.name}</p>
                            <p className="truncate text-xs text-muted">
                              {primary.designation ?? 'Contact'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1.5 text-sm">
                          <a
                            href={`mailto:${primary.email}`}
                            className="flex items-center gap-2 text-muted hover:text-primary"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {primary.email}
                          </a>
                          {primary.phone && (
                            <a
                              href={`tel:${primary.phone}`}
                              className="flex items-center gap-2 text-muted hover:text-primary"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {primary.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <EmptyState compact title="No primary contact" />
                )}
              </Card>

              <Card>
                <CardHeader title="At a glance" />
                <dl className="divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <dt className="text-muted">Live projects</dt>
                    <dd className="font-semibold tabular-nums text-fg">
                      {client.projects.filter((p) => p.status === 'ACTIVE').length}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <dt className="text-muted">Active retainers</dt>
                    <dd className="font-semibold tabular-nums text-fg">
                      {client.retainers.filter((r) => r.status === 'ACTIVE').length}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <dt className="text-muted">Contacts</dt>
                    <dd className="font-semibold tabular-nums text-fg">
                      {client.contacts.length}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="projects">
          <Card>
            <CardHeader title="Projects" />
            {client.projects.length === 0 ? (
              <EmptyState compact title="No projects yet" />
            ) : (
              <ul className="divide-y divide-border">
                {client.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/projects/${project.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{project.name}</p>
                        <p className="font-mono text-2xs text-subtle">{project.code}</p>
                      </div>
                      {project.currentStage && (
                        <span
                          className="hidden text-xs sm:block"
                          style={{ color: project.currentStage.color }}
                        >
                          {project.currentStage.name}
                        </span>
                      )}
                      <ProjectStatusBadge value={project.status} />
                      <HealthBadge value={project.health} />
                      <span className="w-20 shrink-0 text-right text-xs text-muted">
                        {fmtDate(project.dueDate, 'dd MMM yy')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="retainers">
          <Card>
            <CardHeader title="Retainers" description="Recurring engagements" />
            {client.retainers.length === 0 ? (
              <EmptyState compact title="No retainers" />
            ) : (
              <ul className="divide-y divide-border">
                {client.retainers.map((retainer) => (
                  <li key={retainer.id}>
                    <Link
                      to={`/retainers/${retainer.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{retainer.name}</p>
                        <p className="font-mono text-2xs text-subtle">{retainer.code}</p>
                      </div>
                      <Badge tone="neutral">{humanise(retainer.billingCycle)}</Badge>
                      <RetainerStatusBadge value={retainer.status} />
                      {retainer.amountPerCycle && (
                        <span className="shrink-0 text-sm tabular-nums text-fg">
                          {fmtCurrency(retainer.amountPerCycle)}
                        </span>
                      )}
                      <span className="w-20 shrink-0 text-right text-xs text-muted">
                        {retainer.endDate ? `to ${fmtDate(retainer.endDate, 'dd MMM yy')}` : 'Open'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="contacts">
          <Card>
            <CardHeader
              title="Contacts"
              description="Portal access is per contact, and approving is separate from viewing."
              action={
                can('clients.contacts.manage') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setAddingContact(true)}
                  >
                    Add
                  </Button>
                ) : undefined
              }
            />
            {client.contacts.length === 0 ? (
              <EmptyState compact title="No contacts" />
            ) : (
              <ul className="divide-y divide-border">
                {client.contacts.map((contact) => (
                  <li key={contact.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar name={contact.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
                        {contact.name}
                        {contact.isPrimary && (
                          <Star className="h-3 w-3 fill-warning text-warning" />
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {contact.email}
                        {contact.designation ? ` · ${contact.designation}` : ''}
                      </p>
                    </div>

                    {contact.portalEnabled ? (
                      <Badge tone="success" dot>
                        Portal {contact.canApprove ? '+ approvals' : 'viewer'}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">No portal access</Badge>
                    )}

                    {can('clients.portal.manage') &&
                      (contact.portalEnabled ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<ShieldOff className="h-3.5 w-3.5" />}
                          onClick={() => setRevoking(contact)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ShieldCheck className="h-3.5 w-3.5" />}
                          onClick={() => setGrantingPortal(contact)}
                        >
                          Grant portal
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="files">
          <FileList clientId={client.id} folder="documents" title="Client files" />
        </TabPanel>

        <TabPanel value="notes">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Account notes" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-fg">
                {client.notes || 'No notes recorded.'}
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-fg">Internal discussion</h3>
              <CommentThread entityType="CLIENT" entityId={client.id} allowClientVisible={false} />
            </Card>
          </div>
        </TabPanel>
      </Tabs>

      {addingContact && (
        <AddContactModal clientId={client.id} onClose={() => setAddingContact(false)} />
      )}
      {grantingPortal && (
        <GrantPortalModal
          contact={grantingPortal}
          clientId={client.id}
          onClose={() => setGrantingPortal(null)}
        />
      )}
      <RevokePortalDialog
        contact={revoking}
        clientId={client.id}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
}

function AddContactModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    isPrimary: false,
  });

  const create = useMutation({
    mutationFn: () => apiPost(`/clients/${clientId}/contacts`, form),
    onSuccess: () => {
      toast.success('Contact added');
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Add contact"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.name.length < 2 || !form.email.includes('@')}
            onClick={() => create.mutate()}
          >
            Add contact
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            label="Designation"
            value={form.designation}
            onChange={(event) => setForm({ ...form, designation: event.target.value })}
            placeholder="e.g. Marketing Head"
          />
        </div>
        <Checkbox
          checked={form.isPrimary}
          onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })}
          label="Primary contact"
          description="Replaces whoever is currently primary."
        />
      </div>
    </Modal>
  );
}

function GrantPortalModal({
  contact,
  clientId,
  onClose,
}: {
  contact: ClientContact;
  clientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [canApprove, setCanApprove] = useState(false);

  const grant = useMutation({
    mutationFn: () =>
      apiPost(`/clients/contacts/${contact.id}/portal-access`, { canApprove }),
    onSuccess: () => {
      toast.success(`Invitation emailed to ${contact.email}`);
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Grant portal access"
      description={`${contact.name} will be emailed a link to set their own password.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={grant.isPending} onClick={() => grant.mutate()}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-muted">
          Portal accounts only ever see this client’s own projects, deliverables and files.
          They never see budgets, internal comments or anything about other clients.
        </div>
        <Checkbox
          checked={canApprove}
          onChange={(event) => setCanApprove(event.target.checked)}
          label="Allow this contact to approve deliverables"
          description="Leave off for someone who should only follow progress."
        />
      </div>
    </Modal>
  );
}

function RevokePortalDialog({
  contact,
  clientId,
  onClose,
}: {
  contact: ClientContact | null;
  clientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const revoke = useMutation({
    mutationFn: () => apiDelete(`/clients/contacts/${contact?.id}/portal-access`),
    onSuccess: () => {
      toast.success('Portal access revoked');
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <ConfirmDialog
      open={Boolean(contact)}
      onClose={onClose}
      onConfirm={() => revoke.mutate()}
      title="Revoke portal access?"
      message={`${contact?.name} will be signed out immediately and will not be able to sign in again.`}
      confirmLabel="Revoke access"
      loading={revoke.isPending}
    />
  );
}
