import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MoviesApi } from '@features/movies/data-access/movies-api';
import { LibrariesApi } from '@features/libraries/data-access/libraries-api';
import { UploadFacade } from '@features/uploads/services/upload-facade';
import { ToastService } from '@core/ui/toast.service';
import { Library } from '@features/libraries/models/library';
import { AddMediaModal, AddMediaSource } from '@features/dashboard/components/add-media-modal/add-media-modal';
import { ActivityStore } from '@features/activity/data-access/activity-store';
import { ActivityItem } from '@features/activity/models/activity';

@Component({
    selector: 'app-dashboard-overview',
    imports: [AddMediaModal],
    providers: [ActivityStore],
    templateUrl: './dashboard-overview.html',
    styleUrl: './dashboard-overview.css',
})
export class DashboardOverview {
    private readonly moviesApi = inject(MoviesApi);
    private readonly librariesApi = inject(LibrariesApi);
    private readonly uploadFacade = inject(UploadFacade);
    private readonly toast = inject(ToastService);
    private readonly router = inject(Router);
    readonly activityStore = inject(ActivityStore);

    readonly addMediaOpen = signal(false);

    readonly mediaTotal = signal(0);
    readonly identified = signal(0);
    readonly pending = signal(0);
    readonly libraries = signal<Library[]>([]);

    readonly processing = computed(() => this.uploadFacade.activeCount());

    /** El dashboard muestra una ventana corta; Activity conserva la paginación completa. */
    readonly recentActivity = computed(() => this.activityStore.items().slice(0, 4));

    constructor() {
        this.moviesApi.list().subscribe({
            next: (movies) => {
                this.mediaTotal.set(movies.length);
                this.identified.set(movies.filter((m) => m.status === 'READY').length);
                this.pending.set(movies.filter((m) => m.status !== 'READY').length);
            },
            error: () => undefined,
        });

        this.librariesApi.list().subscribe({
            next: (libraries) => this.libraries.set(libraries),
            error: () => undefined,
        });

        this.activityStore.load();
    }

    onSourceSelected(source: AddMediaSource): void {
        if (source === 'upload') {
            this.router.navigate(['/uploads']);
        } else if (source === 'local') {
            this.router.navigate(['/libraries']);
        } else {
            this.toast.info('S3 / Storage llegará pronto.');
        }
    }

    openLibrary(library: Library): void {
        this.router.navigate(['/libraries']);
    }

    activityLabel(activity: ActivityItem): string {
        return activity.resourceTitle || activity.fileName || activity.type;
    }

    activityWhen(activity: ActivityItem): string {
        return activity.lastOccurredAt.toLocaleString();
    }
}
