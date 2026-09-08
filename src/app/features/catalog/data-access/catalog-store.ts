import { computed, inject, Injectable, signal } from '@angular/core';
import { CatalogApi } from '@features/catalog/data-access/catalog-api';
import {
    CatalogItem,
    CatalogPage,
    CatalogSortKey,
    CatalogStatusFilter,
} from '@features/catalog/models/catalog';

export const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Estado de la experiencia Catalog: grilla paginada server-side con
 * filtros (q, status, sort) y selección de filas accionables.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
    private readonly api = inject(CatalogApi);

    readonly items = signal<CatalogItem[]>([]);
    readonly page = signal(0);
    readonly size = signal(PAGE_SIZE);
    readonly total = signal(0);
    readonly totalPages = signal(0);
    readonly summary = signal<CatalogPage['summary']>({ total: 0, ready: 0, needsAttention: 0 });
    readonly loading = signal(false);
    readonly error = signal(false);

    readonly query = signal('');
    readonly statusFilter = signal<CatalogStatusFilter>('ALL');
    readonly sort = signal<CatalogSortKey>('updated');
    readonly dir = signal<'asc' | 'desc'>('desc');

    /** Claves de fila seleccionadas: `${type}:${id}` (MEDIA y ASSET no colisionan). */
    readonly selectedKeys = signal<string[]>([]);

    readonly selectedCount = computed(() => this.selectedKeys().length);

    readonly hasSelection = computed(() => this.selectedKeys().length > 0);

    /** Items seleccionables (cambio de visibilidad masivo). */
    readonly selectableItems = computed(() =>
        this.items().filter((item) => item.capabilities.changeVisibility),
    );

    readonly allSelected = computed(
        () =>
            this.selectableItems().length > 0 &&
            this.selectableItems().every((item) => this.isSelected(item)),
    );

    readonly someSelected = computed(() =>
        this.selectableItems().some((item) => this.isSelected(item)),
    );

    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    /** Busca con debounce y reinicia la página; los demás filtros cargan directo. */
    setQuery(value: string): void {
        this.query.set(value);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.load(0), SEARCH_DEBOUNCE_MS);
    }

    setStatus(value: CatalogStatusFilter): void {
        this.statusFilter.set(value);
        this.load(0);
    }

    setSort(key: CatalogSortKey, dir: 'asc' | 'desc'): void {
        this.sort.set(key);
        this.dir.set(dir);
        this.load(0);
    }

    goTo(page: number): void {
        const target = Math.max(0, Math.min(page, this.totalPages() - 1));
        if (target === this.page()) return;
        this.load(target);
    }

    load(page: number): void {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.clearSelection();
        this.loading.set(true);
        this.error.set(false);
        this.api
            .page({
                page,
                size: this.size(),
                q: this.query(),
                status: this.statusFilter(),
                sort: this.sort(),
                dir: this.dir(),
            })
            .subscribe({
                next: (catalog) => this.apply(catalog),
                error: () => {
                    this.loading.set(false);
                    this.error.set(true);
                },
            });
    }

    /** Recarga la página actual manteniendo la selección. */
    refresh(): void {
        this.load(this.page());
    }

    toggle(item: CatalogItem): void {
        this.selectedKeys.update((keys) => {
            const key = this.keyOf(item);
            return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
        });
    }

    isSelected(item: CatalogItem): boolean {
        return this.selectedKeys().includes(this.keyOf(item));
    }

    toggleSelectAll(): void {
        const selectable = this.selectableItems();
        if (selectable.every((item) => this.isSelected(item))) {
            this.selectedKeys.set([]);
            return;
        }
        this.selectedKeys.set(selectable.map((item) => this.keyOf(item)));
    }

    clearSelection(): void {
        this.selectedKeys.set([]);
    }

    /** movieIds de la selección para la acción masiva (solo filas MEDIA). */
    selectedMovieIds(): number[] {
        return this.items()
            .filter((item) => this.isSelected(item) && item.key.type === 'MEDIA')
            .map((item) => item.mediaId ?? item.key.id);
    }

    private keyOf(item: CatalogItem): string {
        return `${item.key.type}:${item.key.id}`;
    }

    private apply(catalog: CatalogPage): void {
        this.items.set(catalog.items);
        this.page.set(catalog.page);
        this.size.set(catalog.size);
        this.total.set(catalog.total);
        this.totalPages.set(catalog.totalPages);
        this.summary.set(catalog.summary);
        this.loading.set(false);
        this.error.set(false);
    }
}
