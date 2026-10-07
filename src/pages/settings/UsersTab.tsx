import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail, ShieldOff, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtDate, fmtRelative } from '@/lib/utils';
import type { ManagedUser, Role } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dropdown,
  DropdownItem,
  EmptyState,
  ErrorState,
  Select,
  SkeletonRows,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
} from '@/components/ui';
import { FilterBar, FilterSelect, TableCard } from '@/components/ListShell';

export function UsersTab() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [suspending, setSuspending] = useState<ManagedUser | null>(null);

  const list = useListState(
    {
      kind: undefined,
      status: undefined,
      roleId: undefined,
    },
    25,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<ManagedUser>(
    ['users'],
    '/users',
    list.queryParams,
  );

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => apiGet<Role[]>('/roles') });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['users'] });

  const setRole = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string | null }) =>
      apiPatch(`/users/${id}/role`, { roleId }),
    onSuccess: () => {
      toast.success('Role updated');
      invalidate();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      apiPatch(`/users/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Account updated');
      setSuspending(null);
      invalidate();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) => apiPost(`/users/${id}/resend-invite`),
    onSuccess: () => toast.success('Invitation sent'),
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const forceReset = useMutation({
    mutationFn: (id: string) => apiPost(`/users/${id}/force-password-reset`),
    onSuccess: () => {
      toast.success('Password reset emailed; their sessions have ended');
      invalidate();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <>
      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search name or email…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <FilterSelect
          value={list.filters.kind}
          onChange={(value) => list.setFilter('kind', value)}
          options={[
            { value: 'STAFF', label: 'Staff' },
            { value: 'CLIENT', label: 'Client portal' },
          ]}
          allLabel="All account types"
        />
        <FilterSelect
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={['INVITED', 'ACTIVE', 'SUSPENDED']}
          allLabel="All statuses"
        />
        <FilterSelect
          value={list.filters.roleId}
          onChange={(value) => list.setFilter('roleId', value)}
          options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
          allLabel="All roles"
        />
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Type</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Last sign-in</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={8} cols={6} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={6}>
                    <EmptyState title="No accounts match" />
                  </TD>
                </tr>
              ) : (
                data?.data.map((user) => (
                  <TRow key={user.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{user.name}</p>
                          <p className="truncate text-2xs text-muted">{user.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={user.kind === 'CLIENT' ? 'info' : 'neutral'}>
                        {user.kind === 'CLIENT' ? 'Client' : 'Staff'}
                      </Badge>
                      {user.clientContact && (
                        <p className="mt-0.5 truncate text-2xs text-subtle">
                          {user.clientContact.client.name}
                        </p>
                      )}
                    </TD>
                    <TD>
                      {user.kind === 'CLIENT' ? (
                        <span className="text-2xs text-subtle">
                          Scoped to their account
                        </span>
                      ) : (
                        <Select
                          value={user.role?.id ?? ''}
                          onChange={(event) =>
                            setRole.mutate({
                              id: user.id,
                              roleId: event.target.value || null,
                            })
                          }
                          className="w-44"
                          placeholder="No role"
                          options={(roles.data ?? []).map((role) => ({
                            value: role.id,
                            label: role.name,
                          }))}
                        />
                      )}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          user.status === 'ACTIVE'
                            ? 'success'
                            : user.status === 'INVITED'
                              ? 'warning'
                              : 'danger'
                        }
                        dot
                      >
                        {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-muted">
                      {user.lastLoginAt ? (
                        <>
                          <span className="block">{fmtRelative(user.lastLoginAt)}</span>
                          <span className="block text-2xs text-subtle">
                            {fmtDate(user.lastLoginAt)}
                          </span>
                        </>
                      ) : (
                        'Never'
                      )}
                    </TD>
                    <TD>
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        }
                      >
                        {user.status === 'INVITED' && (
                          <DropdownItem
                            icon={<Mail className="h-4 w-4" />}
                            onClick={() => resendInvite.mutate(user.id)}
                          >
                            Resend invitation
                          </DropdownItem>
                        )}
                        <DropdownItem
                          icon={<KeyRound className="h-4 w-4" />}
                          onClick={() => forceReset.mutate(user.id)}
                        >
                          Force password reset
                        </DropdownItem>
                        {user.id !== me?.id &&
                          (user.status === 'SUSPENDED' ? (
                            <DropdownItem
                              icon={<UserCheck className="h-4 w-4" />}
                              onClick={() =>
                                setStatus.mutate({ id: user.id, status: 'ACTIVE' })
                              }
                            >
                              Reactivate
                            </DropdownItem>
                          ) : (
                            <DropdownItem
                              icon={<ShieldOff className="h-4 w-4" />}
                              tone="danger"
                              onClick={() => setSuspending(user)}
                            >
                              Suspend access
                            </DropdownItem>
                          ))}
                      </Dropdown>
                    </TD>
                  </TRow>
                ))
              )}
            </TBody>
          </Table>
        </TableCard>
      )}

      <ConfirmDialog
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        onConfirm={() =>
          suspending && setStatus.mutate({ id: suspending.id, status: 'SUSPENDED' })
        }
        title="Suspend this account?"
        message={`${suspending?.name} will be signed out immediately and cannot sign in until reactivated.`}
        confirmLabel="Suspend"
        loading={setStatus.isPending}
      />
    </>
  );
}
