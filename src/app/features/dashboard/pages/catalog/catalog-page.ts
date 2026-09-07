import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MediaApi } from '@features/media/data-access/media-api';
import { MovieVisibility } from '@features/movies/models/web-movie';
import { MediaAsset } from '@features/libraries/models/library';
import { ActionsMenu, ActionsMenuItem } from '@shared/actions-menu';
import { ConfirmDialog } from '@shared/confirm-dialog';
import { VisibilityModal } from '@features/movies/components/visibility-modal/visibility-modal';
import { IdentifyModal } from '@features/libraries/components/identify-modal/identify-modal';
import { CatalogApi } from '@features/catalog/data-access/catalog-api';
import { CatalogStore } from '@features/catalog/data-access/catalog-store';
import {
    CatalogItem,
    CatalogJob,
    CatalogSortKey,
    CatalogStatusFilter,
} from '@features/catalog/models/catalog';
import { ToastService } from '@core/ui/toast.service';
import { MovieSearchModal } from '@features/uploads/components/movie-search-modal/movie-search-modal';
import { MovieMetadata } from '@features/movies/models/movie-metadata';

const STATUS_OPTIONS: { value: CatalogStatusFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'READY', label: 'READY' },
    { value: 'PROCESSING', label: 'PROCESSING' },
    { value: 'ATTENTION', label: 'ATTENTION' },
    { value: 'UNIDENTIFIED', label: 'UNIDENTIFIED' },
    { value: 'MISSING', label: 'MISSING' },
];

const SORT_OPTIONS: { value: CatalogSortKey; label: string }[] = [
    { value: 'updated', label: 'Más recientes' },
    { value: 'title', label: 'Título' },
    { value: 'year', label: 'Año' },
];

/**
 * Grilla de administración del contenido propio: consume la experiencia
 * Catalog del BFF (paginación server-side, filas MEDIA + ASSET y acciones
 * guiadas por capabilities). La selección alimenta la acción masiva.
 */
@Component({
    selector: 'app-catalog-page',
    imports: [
        ActionsMenu,
        ConfirmDialog,
        FormsModule,
        VisibilityModal,
        IdentifyModal,
        MovieSearchModal,
    ],
    templateUrl: './catalog-page.html',
    styleUrl: './catalog-page.css',
})
export class CatalogPage {
    readonly store = inject(CatalogStore);

    private readonly catalogApi = inject(CatalogApi);
    private readonly mediaApi = inject(MediaApi);
    private readonly toast = inject(ToastService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly statusOptions = STATUS_OPTIONS;
    readonly sortOptions = SORT_OPTIONS;

    readonly visibilityTarget = signal<{
        label: string;
        movieIds: number[];
        initialVisibility: MovieVisibility;
    } | null>(null);

    /** ASSET a identificar desde la grilla (reutiliza el modal de libraries). */
    readonly identifyTarget = signal<MediaAsset | null>(null);
    readonly identifyOpen = signal(false);

    /** Media candidata a borrado + visibilidad del diálogo. */
    readonly deleteTarget = signal<CatalogItem | null>(null);
    readonly confirmOpen = signal(false);
    readonly providerTarget = signal<CatalogItem | null>(null);
    readonly providerOpen = signal(false);
    readonly technicalTarget = signal<CatalogItem | null>(null);

    readonly displayStatusOf = (item: CatalogItem): string => item.displayStatus ?? item.status;

    readonly isReady = (item: CatalogItem): boolean => this.displayStatusOf(item) === 'READY';

    readonly hasMenu = (item: CatalogItem): boolean => {
        const caps = item.capabilities;
        return caps.play || caps.viewDetail || caps.editMetadata
            || caps.changeVisibility || caps.unlinkProvider
            || caps.manageSharing || caps.linkProvider
            || caps.identify || caps.delete;
    };

    /** Acciones de fila según capabilities del BFF; el menú las pinta. */
    actionsFor(item: CatalogItem): ActionsMenuItem[] {
        const caps = item.capabilities;
        const actions: ActionsMenuItem[] = [];
        if (caps.play) actions.push({ label: 'Reproducir', action: () => this.play(item) });
        if (caps.viewDetail) actions.push({ label: 'Ver detalle', action: () => this.viewDetail(item) });
        if (caps.editMetadata) actions.push({ label: 'Editar', action: () => this.edit(item) });
        if (caps.viewDetail) actions.push({ label: 'Información técnica', action: () => this.openTechnical(item) });
        if (caps.changeVisibility) {
            actions.push({ label: 'Cambiar estado', action: () => this.openRowVisibility(item) });
        }
        if (caps.manageSharing && !caps.changeVisibility) {
            actions.push({ label: 'Gestionar compartidos', action: () => this.openRowVisibility(item) });
        }
        if (caps.linkProvider) {
            actions.push({ label: 'Vincular proveedor', action: () => this.openProvider(item) });
        }
        if (caps.identify) {
            actions.push({ label: 'Identificar', action: () => this.openIdentify(item) });
        }
        if (caps.unlinkProvider) {
            actions.push({ label: 'Desvincular proveedor', action: () => this.unlinkProvider(item) });
        }
        if (caps.delete) {
            actions.push({ label: 'Eliminar', action: () => this.requestDelete(item), danger: true });
        }
        return actions;
    }

    readonly mediaIdOf = (item: CatalogItem): number => item.mediaId ?? item.key.id;

    constructor() {
        this.store.load(0);

        // La búsqueda global del shell aterriza aquí: /catalog?q=…
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            const query = params.get('q');
            if (query !== null) this.store.setQuery(query);
        });
    }

    trackBy(_index: number, item: CatalogItem): string {
        return `${item.key.type}:${item.key.id}`;
    }

    play(item: CatalogItem): void {
        this.router.navigate(['/watch', this.mediaIdOf(item)]);
    }

    viewDetail(item: CatalogItem): void {
        if (!item.capabilities.viewDetail || item.mediaId == null) return;
        this.router.navigate(['/catalog', item.mediaId]);
    }

    openDetail(item: CatalogItem, event?: Event): void {
        event?.stopPropagation();
        this.viewDetail(item);
    }

    openTechnical(item: CatalogItem): void {
        if (item.capabilities.viewDetail) this.technicalTarget.set(item);
    }

    closeTechnical(): void {
        this.technicalTarget.set(null);
    }

    openProvider(item: CatalogItem): void {
        if (item.capabilities.linkProvider && item.mediaId != null) {
            this.providerTarget.set(item);
            this.providerOpen.set(true);
        }
    }

    onProviderSelected(movie: MovieMetadata): void {
        const item = this.providerTarget();
        if (!item || !item.capabilities.linkProvider) return;
        this.providerOpen.set(false);
        this.mediaApi.linkProvider(this.mediaIdOf(item), { tmdbId: movie.id }).subscribe({
            next: () => {
                this.providerTarget.set(null);
                this.toast.success('Proveedor vinculado.');
                this.store.refresh();
            },
            error: () => this.toast.error('No se pudo vincular el proveedor.'),
        });
    }

    edit(item: CatalogItem): void {
        this.router.navigate(['/catalog', this.mediaIdOf(item), 'edit']);
    }

    openRowVisibility(item: CatalogItem): void {
        this.visibilityTarget.set({
            label: item.title || 'Untitled',
            movieIds: [this.mediaIdOf(item)],
            initialVisibility: (item.visibility as MovieVisibility) ?? 'PRIVATE',
        });
    }

    openBulkVisibility(visibility: MovieVisibility): void {
        const movieIds = this.store.selectedMovieIds();
        if (!movieIds.length) return;
        this.visibilityTarget.set({
            label: `${movieIds.length} media seleccionada`,
            movieIds,
            initialVisibility: visibility,
        });
    }

    openIdentify(item: CatalogItem): void {
        if (item.assetId == null) return;
        // Forma mínima de MediaAsset para el modal de identify (solo usa id y nombre).
        this.identifyTarget.set({
            id: item.assetId,
            libraryId: 0,
            relativePath: item.title,
            size: 0,
            mimeType: '',
            status: 'UNIDENTIFIED',
            movieId: null,
        });
        this.identifyOpen.set(true);
    }

    unlinkProvider(item: CatalogItem): void {
        this.mediaApi.unlinkProvider(this.mediaIdOf(item)).subscribe({
            next: () => {
                this.toast.success('Proveedor desvinculado.');
                this.store.refresh();
            },
            error: () => this.toast.error('No se pudo desvincular el proveedor.'),
        });
    }

    requestDelete(item: CatalogItem): void {
        this.deleteTarget.set(item);
        this.confirmOpen.set(true);
    }

    confirmDelete(): void {
        const item = this.deleteTarget();
        if (!item) return;
        this.catalogApi.delete(this.mediaIdOf(item)).subscribe({
            next: () => {
                this.toast.success(`«${item.title}» eliminada.`);
                this.deleteTarget.set(null);
                this.confirmOpen.set(false);
                this.store.refresh();
            },
            error: () => {
                this.toast.error('No se pudo eliminar la media.');
                this.deleteTarget.set(null);
                this.confirmOpen.set(false);
            },
        });
    }

    toggleSort(key: CatalogSortKey): void {
        if (this.store.sort() === key) {
            this.store.setSort(key, this.store.dir() === 'asc' ? 'desc' : 'asc');
            return;
        }
        this.store.setSort(key, 'asc');
    }

    cancelDelete(): void {
        this.deleteTarget.set(null);
        this.confirmOpen.set(false);
    }

    onVisibilityClosed(): void {
        this.visibilityTarget.set(null);
    }

    onVisibilityDone(_job: CatalogJob): void {
        this.visibilityTarget.set(null);
        this.store.clearSelection();
        this.store.refresh();
    }

    onIdentified(): void {
        this.identifyOpen.set(false);
        this.identifyTarget.set(null);
        this.toast.success('Media identificada.');
        this.store.refresh();
    }
}
