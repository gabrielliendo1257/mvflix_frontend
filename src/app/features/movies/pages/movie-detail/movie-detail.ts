import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@core/ui/toast.service';
import { MediaApi } from '@features/media/data-access/media-api';
import { MediaDetail } from '@features/media/models/media-detail';
import { MovieVisibility } from '@features/movies/models/web-movie';
import { MovieSearchModal } from '@features/uploads/components/movie-search-modal/movie-search-modal';
import { MovieMetadata } from '@features/movies/models/movie-metadata';
import { ConfirmDialog } from '@shared/confirm-dialog';

const VISIBILITY_LABELS: Record<MovieVisibility, string> = {
    PUBLIC: 'Pública',
    PRIVATE: 'Privada',
    SHARED: 'Compartida',
};

@Component({
    selector: 'app-movie-detail',
    imports: [FormsModule, MovieSearchModal, ConfirmDialog],
    templateUrl: './movie-detail.html',
    styleUrl: './movie-detail.css',
})
export class MovieDetail implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly mediaApi = inject(MediaApi);
    private readonly toast = inject(ToastService);

    readonly visibilityOptions: MovieVisibility[] = ['PRIVATE', 'PUBLIC', 'SHARED'];
    readonly detail = signal<MediaDetail | null>(null);
    readonly loading = signal(true);
    readonly notFound = signal(false);
    readonly error = signal<string | null>(null);
    readonly visibility = signal<MovieVisibility>('PRIVATE');
    readonly sharesInput = signal('');
    readonly saving = signal(false);
    readonly searchOpen = signal(false);
    readonly confirmDeleteOpen = signal(false);

    ngOnInit(): void {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (Number.isNaN(id)) {
            this.notFound.set(true);
            this.loading.set(false);
            return;
        }
        this.load(id);
    }

    visibilityLabel(value: MovieVisibility): string {
        return VISIBILITY_LABELS[value];
    }

    onVisibilityChange(value: MovieVisibility): void {
        if (!this.can('changeVisibility')) return;
        const sharedWith = value === 'SHARED' ? this.parseUsernames() : [];
        if (value === 'SHARED' && !sharedWith.length) {
            this.toast.warning('Escribe al menos un usuario para compartir');
            return;
        }
        this.updateAccess(value, sharedWith);
    }

    saveShares(): void {
        if (!this.can('manageSharing')) return;
        const usernames = this.parseUsernames();
        if (!usernames.length) {
            this.toast.warning('Escribe al menos un usuario');
            return;
        }
        this.updateAccess('SHARED', usernames);
    }

    openProviderSearch(): void {
        if (this.can('linkProvider')) this.searchOpen.set(true);
    }

    onProviderSelected(movie: MovieMetadata): void {
        this.searchOpen.set(false);
        if (!this.can('linkProvider')) return;
        const mediaId = this.detail()?.media.mediaId;
        if (mediaId == null) return;
        this.saving.set(true);
        this.mediaApi.linkProvider(mediaId, { tmdbId: movie.id }).subscribe({
            next: (detail) => {
                this.detail.set(detail);
                this.saving.set(false);
                this.toast.success('Proveedor vinculado.');
            },
            error: () => {
                this.saving.set(false);
                this.toast.error('No se pudo vincular el proveedor.');
            },
        });
    }

    unlinkProvider(): void {
        const mediaId = this.detail()?.media.mediaId;
        if (mediaId == null || !this.can('unlinkProvider')) return;
        this.saving.set(true);
        this.mediaApi.unlinkProvider(mediaId).subscribe({
            next: (detail) => {
                this.detail.set(detail);
                this.saving.set(false);
                this.toast.success('Proveedor desvinculado.');
            },
            error: () => {
                this.saving.set(false);
                this.toast.error('No se pudo desvincular el proveedor.');
            },
        });
    }

    deleteMedia(): void {
        const mediaId = this.detail()?.media.mediaId;
        if (mediaId == null || !this.can('delete')) return;
        this.confirmDeleteOpen.set(false);
        this.saving.set(true);
        this.mediaApi.deleteMedia(mediaId).subscribe({
            next: (response) => {
                this.toast.success(response.status === 202
                    ? 'Eliminación iniciada; puedes seguirla en Activity.'
                    : 'Media eliminada.');
                this.router.navigate(['/catalog']);
            },
            error: () => {
                this.saving.set(false);
                this.toast.error('No se pudo eliminar la media.');
            },
        });
    }

    can(action: keyof MediaDetail['capabilities']): boolean {
        return this.detail()?.capabilities[action] ?? false;
    }

    goCatalog(): void {
        this.router.navigate(['/catalog']);
    }

    private load(id: number): void {
        this.loading.set(true);
        this.mediaApi.detail(id).subscribe({
            next: (detail) => {
                this.detail.set(detail);
                this.visibility.set((detail.media.visibility as MovieVisibility | null) ?? 'PRIVATE');
                this.loading.set(false);
            },
            error: (error: unknown) => {
                this.loading.set(false);
                this.notFound.set(error instanceof HttpErrorResponse && error.status === 404);
                this.error.set(this.notFound() ? null : 'No se pudo cargar el detalle de la media.');
            },
        });
    }

    private updateAccess(visibility: MovieVisibility, sharedWith: string[]): void {
        const mediaId = this.detail()?.media.mediaId;
        if (mediaId == null) return;
        this.saving.set(true);
        this.mediaApi.updateAccess(mediaId, { visibility, sharedWith }).subscribe({
            next: (detail) => {
                this.detail.set(detail);
                this.visibility.set((detail.media.visibility as MovieVisibility | null) ?? visibility);
                this.sharesInput.set('');
                this.saving.set(false);
                this.toast.success(`Visibilidad: ${this.visibilityLabel(visibility)}`);
            },
            error: () => {
                this.saving.set(false);
                this.toast.error('Solo el dueño puede cambiar el acceso.');
            },
        });
    }

    private parseUsernames(): string[] {
        return this.sharesInput().split(',').map((username) => username.trim()).filter(Boolean);
    }
}
