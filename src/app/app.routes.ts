import {Routes} from '@angular/router';
import { authGuard } from '@core/session/auth-guard';

export const routes: Routes = [
    {
        path: '',
        children: [
            {
                path: '',
                redirectTo: 'movies',
                pathMatch: 'full'
            },
            {
                path: 'movies',
                loadComponent: () =>
                    import('./features/movies/pages/personal-movies/personal-movies').then(m => m.PersonalMovies),
            },
            {
                path: 'movies/:id',
                loadComponent: () =>
                    import('./features/movies/pages/movie-detail/movie-detail').then(m => m.MovieDetail),
                canMatch: [authGuard]
            },
            {
                path: 'catalog',
                loadComponent: () =>
                    import('./features/dashboard/pages/catalog/catalog-page').then(m => m.CatalogPage),
                canMatch: [authGuard]
            },
            {
                path: 'media/:id',
                loadComponent: () =>
                    import('./features/movies/pages/movie-detail/movie-detail').then(m => m.MovieDetail),
                canMatch: [authGuard],
            },
            {
                path: 'catalog/:id/edit',
                loadComponent: () =>
                    import('./features/dashboard/pages/edit-media/edit-media-page').then(m => m.EditMediaPage),
                canMatch: [authGuard]
            },
            {
                path: 'uploads',
                loadChildren: () => import('./features/uploads/routes').then(m => m.UPLOAD_ROUTES),
            },
            {
                path: 'libraries',
                loadComponent: () =>
                    import('./features/libraries/pages/libraries-page/libraries-page').then(m => m.LibrariesPage),
            },
            {
                path: 'account',
                loadComponent: () =>
                    import('./features/account/pages/account-page/account-page').then(m => m.AccountPage),
            },
            {
                // Administración: overview de operaciones, assets y actividad.
                // Catalog/Libraries viven como destinos globales de primer nivel.
                path: 'dashboard',
                loadComponent: () =>
                    import('./features/dashboard/dashboard-layout/dashboard-layout').then(m => m.DashboardLayout),
                canMatch: [authGuard],
                children: [
                    {
                        path: '',
                        pathMatch: 'full',
                        loadComponent: () =>
                            import('./features/dashboard/pages/dashboard-overview/dashboard-overview').then(m => m.DashboardOverview),
                    },
                    {
                        path: 'assets',
                        loadComponent: () =>
                            import('./features/dashboard/pages/assets/assets-page').then(m => m.AssetsPage),
                    },
                    {
                        path: 'activity',
                        loadComponent: () =>
                            import('./features/dashboard/pages/activity/activity-page').then(m => m.ActivityPage),
                    },
                    {
                        path: 'settings',
                        loadComponent: () =>
                            import('./features/dashboard/pages/settings/settings-page').then(m => m.SettingsPage),
                    },
                ]
            }
        ]
    },
    {
        path: 'watch/:id',
        loadComponent: () =>
            import('./features/movies/pages/watch-page/watch-page').then(m => m.WatchPage),
    }
];
