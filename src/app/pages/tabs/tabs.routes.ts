import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'groups',
        loadComponent: () =>
          import('../groups/groups.page').then(m => m.GroupsPage)
      },
      {
        path: 'discover',                                     // ← new
        loadComponent: () =>
          import('../discover/discover.page').then(m => m.DiscoverPage)
      },
      {
        path: 'group-detail/:id',
        loadComponent: () =>
          import('../group-detail/group-detail.page').then(m => m.GroupDetailPage)
      },
      {
        path: 'create-group',
        loadComponent: () =>
          import('../create-group/create-group.page').then(m => m.CreateGroupPage)
      },
      {
        path: 'chat/:id',
        loadComponent: () =>
          import('../chat/chat.page').then(m => m.ChatPage)
      },
      {
        path: 'resources/:id',
        loadComponent: () =>
          import('../resources/resources.page').then(m => m.ResourcesPage)
      },
      {
        path: 'manage-group/:id',
        loadComponent: () =>
          import('../manage-group/manage-group.page').then(m => m.ManageGroupPage)
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('../admin/admin.page').then(m => m.AdminPage)
      },
      {
        path: 'superadmin',
        loadComponent: () =>
          import('../superadmin/superadmin.page').then(m => m.SuperadminPage)
      },
     
      { path: '', redirectTo: 'groups', pathMatch: 'full' }
    ]
  }
];