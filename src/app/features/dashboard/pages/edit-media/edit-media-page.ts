import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@core/ui/toast.service';
import { MediaApi } from '@features/media/data-access/media-api';
import { MediaDetail, MediaMetadataUpdate } from '@features/media/models/media-detail';
import { MediaForm, MediaFormValue } from '@features/movies/components/media-form/media-form';
import { MediaKind } from '@features/movies/models/media-kind';
import { MovieMetadata } from '@features/movies/models/movie-metadata';
import { MovieSearchModal } from '@features/uploads/components/movie-search-modal/movie-search-modal';

@Component({
    selector: 'app-edit-media-page',
    imports: [MediaForm, MovieSearchModal],
    templateUrl: './edit-media-page.html',
    styleUrl: './edit-media-page.css',
})
export class EditMediaPage {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly mediaApi = inject(MediaApi);
    private readonly toast = inject(ToastService);

    readonly detail = signal<MediaDetail | null>(null);
    readonly metadata = signal<MovieMetadata | null>(null);
    readonly initialKind = signal<MediaKind>('MOVIE');
    readonly searchOpen = signal(false);
    readonly saving = signal(false);
    readonly notFound = signal(false);
    readonly loading = signal(true);

    ngOnInit(): void {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (Number.isNaN(id)) {
            this.notFound.set(true);
            this.loading.set(false);
            return;
        }
        this.mediaApi.detail(id).subscribe({
            next: (detail) => {
                this.detail.set(detail);
                this.metadata.set(toMetadata(detail));
                this.initialKind.set(detail.media.kind);
                this.loading.set(false);
            },
            error: () => {
                this.notFound.set(true);
                this.loading.set(false);
            },
        });
    }

    onMovieSelected(movie: MovieMetadata): void {
        const detail = this.detail();
        if (!detail?.capabilities.linkProvider) return;

        this.searchOpen.set(false);
        this.saving.set(true);
        this.mediaApi.linkProvider(detail.media.mediaId, { tmdbId: movie.id }).subscribe({
            next: (updated) => {
                this.detail.set(updated);
                this.metadata.set(toMetadata(updated));
                this.initialKind.set(updated.media.kind);
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
        const detail = this.detail();
        if (!detail?.capabilities.unlinkProvider) return;

        this.saving.set(true);
        this.mediaApi.unlinkProvider(detail.media.mediaId).subscribe({
            next: (updated) => {
                this.detail.set(updated);
                this.metadata.set(toMetadata(updated));
                this.saving.set(false);
                this.toast.success('Proveedor desvinculado.');
            },
            error: () => {
                this.saving.set(false);
                this.toast.error('No se pudo desvincular el proveedor.');
            },
        });
    }

    openSearch(): void {
        if (this.detail()?.capabilities.linkProvider) this.searchOpen.set(true);
    }

    onSave(value: MediaFormValue): void {
        const detail = this.detail();
        if (!detail?.capabilities.editMetadata) return;

        this.saving.set(true);
        this.mediaApi.updateMetadata(detail.media.mediaId, toMetadataUpdate(value)).subscribe({
            next: (updated) => {
                this.detail.set(updated);
                this.metadata.set(toMetadata(updated));
                this.initialKind.set(updated.media.kind);
                this.saving.set(false);
                this.toast.success('Metadata actualizada.');
                this.router.navigate(['/catalog']);
            },
            error: () => {
                this.saving.set(false);
                this.toast.error('No se pudo actualizar la metadata.');
            },
        });
    }

    cancel(): void {
        this.router.navigate(['/catalog']);
    }
}

function toMetadata(detail: MediaDetail): MovieMetadata {
    const overview = detail.overview;
    return {
        id: detail.provider.providerId ?? 0,
        title: overview.title,
        originalTitle: overview.originalTitle ?? '',
        year: overview.year,
        genres: overview.genres ?? [],
        popularity: 5,
        duration: overview.duration ?? '',
        director: overview.director ?? '',
        cast: overview.cast ?? [],
        overview: overview.overview ?? '',
        poster_path: overview.posterUrl,
        release_date: '',
        country: '',
        language: '',
        awards: [],
    };
}

function toMetadataUpdate(value: MediaFormValue): MediaMetadataUpdate {
    const metadata = value.metadata;
    if (value.kind === 'VIDEO') return { title: metadata.title, kind: 'VIDEO' };
    return {
        title: metadata.title,
        originalTitle: metadata.originalTitle,
        year: metadata.year,
        genres: metadata.genres,
        duration: metadata.duration,
        director: metadata.director,
        cast: metadata.cast,
        overview: metadata.overview,
        posterUrl: metadata.poster_path,
        releaseDate: metadata.release_date ?? null,
        country: metadata.country,
        language: metadata.language,
        awards: metadata.awards,
        popularity: metadata.popularity,
        kind: 'MOVIE',
    };
}
