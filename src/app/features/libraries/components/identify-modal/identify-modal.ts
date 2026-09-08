import { Component, inject, input, model, output, signal } from '@angular/core';
import { ScrollLock } from '@shared/scroll-lock';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, map, Subject, switchMap } from 'rxjs';
import { LibrariesApi } from '@features/libraries/data-access/libraries-api';
import { MediaKind } from '@features/movies/models/media-kind';
import { EnrichmentSearchResult } from '@features/movies/models/enrichment';
import { EnrichmentApi } from '@features/movies/data-access/enrichment-api';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

export interface IdentifyTarget {
    readonly id: number;
    readonly label: string;
}

@Component({
    selector: 'app-identify-modal',
    imports: [ ScrollLock,FormsModule],
    templateUrl: './identify-modal.html',
    styleUrl: './identify-modal.css',
})
export class IdentifyModal {
    private readonly librariesApi = inject(LibrariesApi);
    private readonly enrichmentApi = inject(EnrichmentApi);

    private readonly searchSubject = new Subject<string>();

    readonly isOpen = model(false);
    readonly asset = input<IdentifyTarget | null>(null);

    readonly identified = output<void>();

    readonly kind = signal<MediaKind>('MOVIE');
    readonly query = signal('');
    readonly results = signal<EnrichmentSearchResult[]>([]);
    readonly submitting = signal(false);

    constructor() {
        this.searchSubject
            .pipe(
                debounceTime(SEARCH_DEBOUNCE_MS),
                map((value) => value.trim()),
                filter((q) => q.length >= MIN_QUERY_LENGTH),
                distinctUntilChanged(),
                switchMap((q) => this.enrichmentApi.search(q)),
            )
            .subscribe({
                next: (results) => this.results.set(results),
                error: () => this.results.set([]),
            });
    }

    setKind(value: MediaKind): void {
        this.kind.set(value);
        this.results.set([]);
    }

    onQuery(value: string): void {
        this.query.set(value);
        this.searchSubject.next(value);
    }

    pickResult(result: EnrichmentSearchResult): void {
        this.query.set(result.title);
        this.confirm({ title: result.title, tmdbId: result.tmdb_id });
    }

    confirm(request?: { title: string; tmdbId?: number }): void {
        const asset = this.asset();
        if (!asset) return;
        const title = request?.title ?? this.query().trim();
        if (!title) return;

        this.submitting.set(true);
        this.librariesApi
            .identify(asset.id, { title, tmdbId: request?.tmdbId, kind: this.kind() })
            .subscribe({
            next: () => {
                this.submitting.set(false);
                this.query.set('');
                this.results.set([]);
                this.isOpen.set(false);
                this.identified.emit();
            },
            error: () => {
                this.submitting.set(false);
            },
        });
    }

    close(): void {
        if (this.submitting()) return;
        this.query.set('');
        this.results.set([]);
        this.isOpen.set(false);
    }
}
