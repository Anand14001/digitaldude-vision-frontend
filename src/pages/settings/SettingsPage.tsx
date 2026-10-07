import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { PageHeader, Tab, TabList, TabPanel, Tabs } from '@/components/ui';
import { OrgSettingsTab } from './OrgSettingsTab';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';
import { MastersTab } from './MastersTab';

/**
 * Settings is one page with tabs rather than five routes: everything here is
 * administrative, infrequent, and easier to reason about side by side.
 */
export function SettingsPage() {
  const { can } = useAuth();

  const tabs = [
    { value: 'org', label: 'Organisation', show: can('settings.org.manage') },
    { value: 'roles', label: 'Roles & permissions', show: can('settings.roles.manage') },
    { value: 'users', label: 'Users', show: can('settings.users.manage') },
    { value: 'masters', label: 'Master data', show: can('settings.masters.manage') },
  ].filter((tab) => tab.show);

  const [tab, setTab] = useState(tabs[0]?.value ?? 'org');

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Roles, people and the reference data the rest of Vision runs on. Workflows have their own screen, next to Projects."
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          {tabs.map((entry) => (
            <Tab key={entry.value} value={entry.value}>
              {entry.label}
            </Tab>
          ))}
        </TabList>

        <TabPanel value="org">
          <OrgSettingsTab />
        </TabPanel>
        <TabPanel value="roles">
          <RolesTab />
        </TabPanel>
        <TabPanel value="users">
          <UsersTab />
        </TabPanel>
        <TabPanel value="masters">
          <MastersTab />
        </TabPanel>
      </Tabs>
    </div>
  );
}
