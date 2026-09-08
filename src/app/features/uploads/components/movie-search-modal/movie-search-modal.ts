import { Component, computed, inject, model, output, signal } from '@angular/core';
import { ScrollLock } from '@shared/scroll-lock';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    EMPTY,
    filter,
    map,
    Subject,
    switchMap,
    tap,
} from 'rxjs';
import { AddMediaApi } from '@features/uploads/data-access/add-media-api';
import { MovieCandidate, MovieCandidatePreview } from '@features/uploads/models/add-media';
import { ProviderCandidate } from '@features/movies/models/provider-candidate';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const CACHE_MAX_ENTRIES = 100;

/** Selección de candidato TMDB dentro de la experiencia de alta/edición. */
@Component({
    selector: 'app-movie-search-modal',
    imports: [ ScrollLock,FormsModule],
    templateUrl: './movie-search-modal.html',
    styleUrl: './movie-search-modal.css',
})
export class MovieSearchModal {
    private readonly addMediaApi = inject(AddMediaApi);

    private readonly searchSubject = new Subject<string>();
    private readonly cache = new Map<string, MovieCandidate[]>();

    isOpen = model(false);
    movieSelected = output<ProviderCandidate>();

    readonly query = signal('');
    readonly results = signal<MovieCandidate[]>([]);
    readonly searching = signal(false);

    readonly showNoResults = computed(
        () => !this.searching() && this.query().trim().length >= MIN_QUERY_LENGTH && !this.results().length,
    );

    constructor() {
        this.searchSubject
            .pipe(
                debounceTime(SEARCH_DEBOUNCE_MS),
                map((value) => value.trim()),
                filter((query) => query.length >= MIN_QUERY_LENGTH),
                distinctUntilChanged(),
                switchMap((query) => this.performSearch(query)),
            )
            .subscribe();
    }

    onSearchInput(value: string): void {
        this.query.set(value);
        this.searchSubject.next(value);
    }

    selectMovie(candidate: MovieCandidate): void {
        lastValueFrom(
            this.addMediaApi.candidatePreview(candidate.providerId).pipe(
                map(toMetadata),
                catchError((error) => {
                    console.error(error);
                    return EMPTY;
                }),
            ),
        )
            .then((metadata) => {
                if (metadata) this.movieSelected.emit(metadata);
            })
            .catch(() => undefined);
    }

    close(): void {
        this.isOpen.set(false);
        this.query.set('');
        this.results.set([]);
    }

    onBackdropClick(e: MouseEvent): void {
        if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close();
        }
    }

    private performSearch(query: string) {
        const cached = this.cache.get(query);
        if (cached) {
            this.cache.delete(query);
            this.cache.set(query, cached);
            this.results.set(cached);
            this.searching.set(false);
            return EMPTY;
        }

        this.searching.set(true);

        return this.addMediaApi.searchCandidates(query).pipe(
            tap((movies) => {
                this.setCache(query, movies);
                this.results.set(movies);
                this.searching.set(false);
            }),
            catchError((error) => {
                console.error(error);
                this.searching.set(false);
                return EMPTY;
            }),
        );
    }

    private setCache(query: string, movies: MovieCandidate[]): void {
        this.cache.set(query, movies);

        if (this.cache.size > CACHE_MAX_ENTRIES) {
            const oldest = this.cache.keys().next();
            if (oldest.value !== undefined) this.cache.delete(oldest.value);
        }
    }
}

function toMetadata(preview: MovieCandidatePreview): ProviderCandidate {
    return {
        id: preview.providerId,
        title: preview.title,
        originalTitle: preview.originalTitle,
        year: preview.year,
        genres: preview.genres,
        popularity: 5,
        duration: preview.duration,
        director: preview.director,
        cast: preview.cast,
        overview: preview.overview,
        poster_path: preview.posterPath,
        release_date: preview.releaseDate,
        country: preview.country,
        language: preview.language,
        awards: [],
    };
}
