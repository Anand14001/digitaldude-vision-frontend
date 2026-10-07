import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ExternalLink,
  Mail,
  Phone,
  Pencil,
  Plus,
  ShieldCheck,
  ShieldOff,
  Star,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtCurrency, fmtDate, humanise } from '@/lib/utils';
import type {
  ClientContact,
  ClientDetail,
  EmployeeListItem,
  MasterRecord,
} from '@/types/api';
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
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
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
  const [editingClient, setEditingClient] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [removingContact, setRemovingContact] = useState<ClientContact | null>(null);
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
          <>
            {can('clients.update') && (
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditingClient(true)}>
                Edit client
              </Button>
            )}
            {can('clients.contacts.manage') && (
              <Button
                icon={<UserPlus className="h-4 w-4" />}
                variant="secondary"
                onClick={() => setAddingContact(true)}
              >
                Add contact
              </Button>
            )}
          </>
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

                    {can('clients.contacts.manage') && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${contact.name}`}
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => setEditingContact(contact)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${contact.name}`}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => setRemovingContact(contact)}
                        />
                      </>
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

      {editingClient && (
        <EditClientModal client={client} onClose={() => setEditingClient(false)} />
      )}
      {addingContact && (
        <AddContactModal clientId={client.id} onClose={() => setAddingContact(false)} />
      )}
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          clientId={client.id}
          onClose={() => setEditingContact(null)}
        />
      )}
      <RemoveContactDialog
        contact={removingContact}
        clientId={client.id}
        onClose={() => setRemovingContact(null)}
      />
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


const CLIENT_STATUSES = ['PROSPECT', 'ACTIVE', 'PAUSED', 'CHURNED'] as const;

/** Edits the account itself: details, who manages it, and what they buy. */
function EditClientModal({ client, onClose }: { client: ClientDetail; onClose: () => void }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: client.name,
    legalName: client.legalName ?? '',
    status: client.status as string,
    industry: client.industry ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
    gstin: client.gstin ?? '',
    addressLine: client.addressLine ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    pincode: client.pincode ?? '',
    accountManagerId: client.accountManager?.id ?? '',
    notes: client.notes ?? '',
    serviceLineIds: client.serviceLines.map((entry) => entry.serviceLine.id),
  });

  const serviceLines = useQuery({
    queryKey: ['options', 'service-lines'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/service-lines?pageSize=100'),
  });
  const managers = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
  });

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/clients/${client.id}`, {
        name: form.name,
        legalName: form.legalName || null,
        status: form.status,
        industry: form.industry || null,
        // Empty strings rather than null: the API validates these as optional
        // URLs and emails, which reject null but accept an empty value.
        email: form.email,
        website: form.website,
        phone: form.phone || null,
        gstin: form.gstin || null,
        addressLine: form.addressLine || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        accountManagerId: form.accountManagerId || null,
        notes: form.notes || null,
        serviceLineIds: form.serviceLineIds,
      }),
    onSuccess: () => {
      toast.success('Client updated');
      void queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${client.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={form.name.trim().length < 2}
            onClick={() => save.mutate()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Client name"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Legal name"
            value={form.legalName}
            onChange={(event) => setForm({ ...form, legalName: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            options={CLIENT_STATUSES.map((value) => ({ value, label: humanise(value) }))}
            hint={form.status === 'CHURNED' ? 'Records the churn date' : undefined}
          />
          <Input
            label="Industry"
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          />
          <Select
            label="Account manager"
            value={form.accountManagerId}
            onChange={(event) => setForm({ ...form, accountManagerId: event.target.value })}
            placeholder="Unassigned"
            options={(managers.data ?? []).map((employee) => ({
              value: employee.id,
              label: employee.user.name,
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            label="Website"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
            placeholder="https://"
          />
        </div>

        <Input
          label="Address"
          value={form.addressLine}
          onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-4">
          <Input
            label="City"
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
          />
          <Input
            label="State"
            value={form.state}
            onChange={(event) => setForm({ ...form, state: event.target.value })}
          />
          <Input
            label="Pincode"
            value={form.pincode}
            onChange={(event) => setForm({ ...form, pincode: event.target.value })}
          />
          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={(event) => setForm({ ...form, gstin: event.target.value })}
          />
        </div>

        <div>
          <span className="dd-label">Services they buy</span>
          <div className="flex flex-wrap gap-1.5">
            {(serviceLines.data ?? []).map((line) => {
              const selected = form.serviceLineIds.includes(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      serviceLineIds: selected
                        ? form.serviceLineIds.filter((id) => id !== line.id)
                        : [...form.serviceLineIds, line.id],
                    })
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted hover:border-border-strong',
                  )}
                >
                  {String(line.name)}
                </button>
              );
            })}
          </div>
        </div>

        <Textarea
          label="Notes"
          rows={3}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>
    </Modal>
  );
}

/** Edits one contact at the client. Portal access is managed separately. */
function EditContactModal({
  contact,
  clientId,
  onClose,
}: {
  contact: ClientContact;
  clientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: contact.name,
    email: contact.email,
    phone: contact.phone ?? '',
    designation: contact.designation ?? '',
    isPrimary: contact.isPrimary,
  });

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/clients/contacts/${contact.id}`, {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        designation: form.designation || null,
        isPrimary: form.isPrimary,
      }),
    onSuccess: () => {
      toast.success('Contact updated');
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${contact.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={form.name.trim().length < 2 || !form.email.includes('@')}
            onClick={() => save.mutate()}
          >
            Save changes
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
          hint={
            contact.portalEnabled
              ? 'This is also their portal sign-in address.'
              : undefined
          }
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

function RemoveContactDialog({
  contact,
  clientId,
  onClose,
}: {
  contact: ClientContact | null;
  clientId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => apiDelete(`/clients/contacts/${contact?.id}`),
    onSuccess: () => {
      toast.success('Contact removed');
      void queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <ConfirmDialog
      open={Boolean(contact)}
      onClose={onClose}
      onConfirm={() => remove.mutate()}
      title="Remove this contact?"
      message={
        contact?.portalEnabled
          ? `${contact.name} will be removed and their portal access ends immediately.`
          : `${contact?.name} will be removed from this client.`
      }
      confirmLabel="Remove contact"
      loading={remove.isPending}
    />
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
