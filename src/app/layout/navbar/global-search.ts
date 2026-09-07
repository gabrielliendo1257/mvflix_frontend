import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchApi } from '@features/search/data-access/search-api';
import { SearchResult } from '@features/search/models/search-result';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';

/**
 * Búsqueda global del shell: consulta contenido visible y navega a la
 * experiencia correspondiente, sin mezclarla con el catálogo administrado.
 */
@Component({
    selector: 'app-global-search',
    imports: [FormsModule],
    template: `
        <div class="search">
            <!-- Desktop -->
            <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
                class="search-input"
                type="text"
                placeholder="Search media..."
                [ngModel]="term()"
                 (ngModelChange)="onTermChange($event)"
                 (keydown)="onKeydown($event)"
            />
            @if (showSuggestions()) {
                <div class="suggestions" role="listbox">
                    @if (loading()) {
                        <div class="suggestion-state">Searching...</div>
                    } @else if (empty()) {
                        <div class="suggestion-state">No media found.</div>
                    } @else {
                        @for (result of results(); track result.id; let i = $index) {
                            <button class="suggestion" [class.active]="i === activeIndex()" type="button" role="option" [attr.aria-selected]="i === activeIndex()" (mousedown)="$event.preventDefault()" (click)="select(result)">
                                @if (result.posterUrl) { <img [src]="result.posterUrl" [alt]="" /> }
                                <span class="suggestion-copy"><strong>{{ result.title }}</strong><small>{{ result.kind }}{{ result.year ? ' · ' + result.year : '' }}</small></span>
                            </button>
                        }
                    }
                </div>
            }

            <!-- Tablet/mobile: icono que abre el panel de búsqueda -->
            <button class="search-toggle" type="button" (click)="open.set(true)"
                    aria-label="Buscar">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
            </button>

            @if (open()) {
                <div class="search-overlay">
                    <input
                        #mobileInput
                        class="search-input"
                        type="text"
                        placeholder="Search media..."
                        [ngModel]="term()"
                        (ngModelChange)="onTermChange($event)"
                        (keydown)="onKeydown($event)"
                    />
                    <button class="search-close" type="button" (click)="close()"
                            aria-label="Cerrar búsqueda">×</button>
                </div>
            }
        </div>
    `,
    styles: `
        .search {
            position: relative;
            display: flex;
            align-items: center;
        }

        .search-icon {
            position: absolute;
            left: 0.65rem;
            color: #92929e;
            pointer-events: none;
        }

        .search-input {
            width: 200px;
            padding: 0.45rem 0.75rem 0.45rem 2rem;
            border-radius: 8px;
            border: 1px solid #26262f;
            background: rgba(255, 255, 255, 0.05);
            color: #e4e4ec;
            font-size: 0.82rem;
            outline: none;
            transition: border-color 0.2s ease, background 0.2s ease;
        }

        .search-input::placeholder { color: #6d6d7a; }
            .search-input:focus { border-color: rgba(255, 109, 63, 0.4); background: rgba(255, 255, 255, 0.08); }

        .suggestions {
            position: absolute;
            top: calc(100% + 0.4rem);
            left: 0;
            width: 310px;
            z-index: 120;
            overflow: hidden;
            border: 1px solid #26262f;
            border-radius: 10px;
            background: #16161d;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
        }

        .suggestion, .suggestion-state {
            display: flex;
            width: 100%;
            align-items: center;
            gap: 0.65rem;
            padding: 0.55rem 0.7rem;
            border: 0;
            background: transparent;
            color: #e4e4ec;
            text-align: left;
        }

        .suggestion { cursor: pointer; }
        .suggestion:hover, .suggestion.active { background: rgba(255, 109, 63, 0.12); }
        .suggestion img { width: 28px; height: 38px; border-radius: 3px; object-fit: cover; background: #26262f; }
        .suggestion-copy { display: flex; min-width: 0; flex-direction: column; gap: 0.15rem; }
        .suggestion-copy strong { overflow: hidden; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
        .suggestion-copy small, .suggestion-state { color: #92929e; font-size: 0.7rem; }

        .search-toggle { display: none; }

        @media (max-width: 1023px) {
            .search > .search-icon,
            .search > .search-input { display: none; }

            .search-toggle {
                display: grid;
                place-items: center;
                width: 34px;
                height: 34px;
                border: none;
                border-radius: 8px;
                background: none;
                color: #92929e;
                cursor: pointer;
            }

            .search-toggle:hover { color: #e4e4ec; background: rgba(255, 255, 255, 0.06); }

            .search-overlay {
                position: fixed;
                inset: 60px 0 auto 0;
                z-index: 99;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.6rem 1rem;
                background: rgba(12, 12, 15, 0.96);
                border-bottom: 1px solid #1e1e26;
            }

            .search-overlay .search-input {
                flex: 1;
                width: auto;
                display: block;
            }

            .search-overlay .suggestions {
                position: absolute;
                top: calc(100% + 0.4rem);
                left: 1rem;
                width: calc(100% - 4rem);
            }

            .search-close {
                border: none;
                background: none;
                color: #92929e;
                font-size: 1.3rem;
                cursor: pointer;
            }
        }
    `,
})
export class GlobalSearch {
    private readonly router = inject(Router);
    private readonly searchApi = inject(SearchApi);
    private readonly searchSubject = new Subject<string>();

    readonly term = signal('');
    readonly open = signal(false);
    readonly results = signal<SearchResult[]>([]);
    readonly loading = signal(false);
    readonly activeIndex = signal(-1);
    readonly empty = computed(() => !this.loading() && this.term().trim().length >= 2 && !this.results().length);
    readonly showSuggestions = computed(() => this.term().trim().length >= 2 && (this.loading() || this.results().length > 0 || this.empty()));

    constructor() {
        this.searchSubject.pipe(
            debounceTime(250),
            distinctUntilChanged(),
            tap((query) => this.loading.set(query.length >= 2)),
            switchMap((query) => query.length < 2
                ? of([])
                : this.searchApi.search(query).pipe(catchError(() => of([])))),
        ).subscribe((results) => {
            this.results.set(results);
            this.activeIndex.set(-1);
            this.loading.set(false);
        });
    }

    onTermChange(value: string): void {
        this.term.set(value);
        if (value.trim().length < 2) {
            this.results.set([]);
            this.loading.set(false);
        }
        this.searchSubject.next(value.trim());
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.activeIndex.update((index) => Math.min(index + 1, this.results().length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.activeIndex.update((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const result = this.results()[this.activeIndex()];
            if (result) this.select(result);
        } else if (event.key === 'Escape') {
            this.results.set([]);
            this.activeIndex.set(-1);
        }
    }

    select(result: SearchResult): void {
        this.router.navigate([result.playable ? '/watch' : '/media', result.id]);
        this.close();
    }

    submit(): void {
        const query = this.term().trim();
        if (!query) return;

        const result = this.results()[this.activeIndex()];
        if (result) this.select(result);
        return;
    }

    close(): void {
        this.term.set('');
        this.open.set(false);
        this.results.set([]);
        this.activeIndex.set(-1);
    }
}
