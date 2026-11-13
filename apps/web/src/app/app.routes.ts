import type { Routes } from '@angular/router';

import { signedIn, signedOut } from './core/auth.service';
import { Shell } from './core/layout/shell';

// Same paths as the old web app, so bookmarks and the auth Redirect URLs (/, /settings, /reset-password) still work.
// Every feature is its own lazy chunk.
export const routes: Routes = [
  { path: 'sign-in', canActivate: [signedOut], title: 'Đăng nhập', loadComponent: () => import('./features/auth/sign-in').then((m) => m.SignIn) },
  { path: 'reset-password', title: 'Đặt mật khẩu mới', loadComponent: () => import('./features/auth/reset-password').then((m) => m.ResetPassword) },
  { path: 'design-system', title: 'Design system', loadComponent: () => import('./features/design-system/design-system').then((m) => m.DesignSystem) },
  // The old phone route for a task: open it over Today instead.
  { path: 'task/:id', redirectTo: ({ params }) => `/?task=${encodeURIComponent(params['id'])}` },
  {
    path: '',
    component: Shell,
    canActivate: [signedIn],
    children: [
      { path: '', title: 'Hôm nay', loadComponent: () => import('./features/today/today').then((m) => m.Today) },
      { path: 'upcoming', title: 'Sắp tới', loadComponent: () => import('./features/upcoming/upcoming').then((m) => m.Upcoming) },
      { path: 'inbox', title: 'Hộp thư', loadComponent: () => import('./features/inbox/inbox').then((m) => m.Inbox) },
      { path: 'projects', title: 'Project', loadComponent: () => import('./features/projects/projects').then((m) => m.Projects) },
      { path: 'project/:id', title: 'Project', loadComponent: () => import('./features/projects/project').then((m) => m.ProjectPage) },
      { path: 'journal', title: 'Nhật ký', loadComponent: () => import('./features/journal/journal').then((m) => m.Journal) },
      { path: 'stats', title: 'Thống kê', loadComponent: () => import('./features/stats/stats').then((m) => m.Stats) },
      { path: 'search', title: 'Tìm kiếm', loadComponent: () => import('./features/search/search').then((m) => m.Search) },
      { path: 'reports', title: 'Báo cáo ngày', loadComponent: () => import('./features/reports/reports').then((m) => m.Reports) },
      { path: 'report/:day', title: 'Báo cáo ngày', loadComponent: () => import('./features/reports/report').then((m) => m.ReportPage) },
      { path: 'settings', title: 'Cài đặt', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings) },
      { path: 'browse', redirectTo: 'projects' },
    ],
  },
  { path: '**', redirectTo: '' },
];
