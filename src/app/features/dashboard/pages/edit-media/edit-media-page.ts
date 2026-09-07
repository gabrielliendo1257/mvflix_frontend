import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@core/ui/toast.service';
import { MoviesApi } from '@features/movies/data-access/movies-api';
import { WebMovie } from '@features/movies/models/web-movie';
import { MovieUpdateRequest } from '@features/movies/models/movie-update';
import { MediaKind } from '@features/movies/models/media-kind';
import { MediaForm, MediaFormValue } from '@features/movies/components/media-form/media-form';
import { MovieSearchModal } from '@features/uploads/components/movie-search-modal/movie-search-modal';
import { MovieMetadata } from '@features/movies/models/movie-metadata';

@Component({
    selector: 'app-edit-media-page',
    imports: [MediaForm, MovieSearchModal],
    templateUrl: './edit-media-page.html',
    styleUrl: './edit-media-page.css',
})
export class EditMediaPage {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly moviesApi = inject(MoviesApi);
    private readonly toast = inject(ToastService);

    readonly movie = signal<WebMovie | null>(null);
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
        this.moviesApi.findById(id).subscribe({
            next: (movie) => {
                this.movie.set(movie);
                this.metadata.set(movie);
                this.initialKind.set(movie.kind ?? 'MOVIE');
                this.loading.set(false);
            },
            error: () => {
                this.notFound.set(true);
                this.loading.set(false);
            },
        });
    }

    onMovieSelected(movie: MovieMetadata): void {
        this.metadata.set(movie);
        this.searchOpen.set(false);
    }

    openSearch(): void {
        this.searchOpen.set(true);
    }

    onSave(value: MediaFormValue): void {
        const movie = this.movie();
        if (!movie) return;
        const m = value.metadata;
        const request: MovieUpdateRequest =
            value.kind === 'VIDEO'
                ? { title: m.title, kind: 'VIDEO' }
                : {
                      title: m.title,
                      originalTitle: m.originalTitle,
                      year: m.year,
                      genres: m.genres,
                      duration: m.duration,
                      director: m.director,
                      cast: m.cast,
                      overview: m.overview,
                      poster_path: m.poster_path,
                      release_date: m.release_date ?? undefined,
                      country: m.country,
                      language: m.language,
                      awards: m.awards,
                      popularity: m.popularity,
                      kind: 'MOVIE',
                  };
        this.saving.set(true);
        this.moviesApi.update(movie.id, request).subscribe({
            next: () => {
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
