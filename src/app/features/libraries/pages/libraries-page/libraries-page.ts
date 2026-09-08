import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/session/auth.service';
import { ToastService } from '@core/ui/toast.service';
import { LibrariesApi } from '@features/libraries/data-access/libraries-api';
import { Library, MediaAsset } from '@features/libraries/models/library';
import { MovieVisibility } from '@features/movies/models/web-movie';
import { VisibilityModal } from '@features/movies/components/visibility-modal/visibility-modal';
import { CatalogJob } from '@features/catalog/models/catalog';
import { IdentifyModal, IdentifyTarget } from '@features/libraries/components/identify-modal/identify-modal';
import { BytesPipe } from '@shared/pipes/bytes.pipe';
import { ActionsMenu, ActionsMenuItem } from '@shared/actions-menu';

const PAGE_SIZE = 20;

interface VisibilityTarget {
    label: string;
    movieIds?: number[];
    libraryIds?: number[];
    initialVisibility?: MovieVisibility;
}

@Component({
    selector: 'app-libraries-page',
    imports: [ ActionsMenu,FormsModule, VisibilityModal, IdentifyModal, BytesPipe],
    templateUrl: './libraries-page.html',
    styleUrl: './libraries-page.css',
})
export class LibrariesPage {
    private readonly librariesApi = inject(LibrariesApi);
    private readonly toast = inject(ToastService);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    readonly isLogged = this.authService.isLogged;

    readonly libraries = signal<Library[]>([]);
    readonly loading = signal(false);
    readonly rootPath = signal('');
    readonly registering = signal(false);

    readonly selected = signal<Library | null>(null);
    readonly assets = signal<MediaAsset[]>([]);
    readonly assetsTotal = signal(0);
    readonly assetsPage = signal(0);
    readonly assetsTotalPages = signal(0);
    readonly loadingAssets = signal(false);
    readonly unidentifiedCount = signal(0);

    readonly identifyTarget = signal<IdentifyTarget | null>(null);
    readonly identifyOpen = signal(false);

    readonly visibilityTarget = signal<VisibilityTarget | null>(null);

    readonly selectedAssetIds = signal<number[]>([]);

    readonly selectedCount = computed(() => this.selectedAssetIds().length);

    readonly allSelected = computed(
        () =>
            this.assets().length > 0 &&
            this.assets().every((asset) => this.selectedAssetIds().includes(asset.id)),
    );

    readonly someSelected = computed(() =>
        this.assets().some((asset) => this.selectedAssetIds().includes(asset.id)),
    );

    readonly identifiedCount = computed(() =>
        Math.max(0, this.assetsTotal() - this.unidentifiedCount()),
    );

    readonly selectedName = computed(() => {
        const selected = this.selected();
        return selected ? `Biblioteca #${selected.id} (${selected.type})` : '';
    });

    constructor() {}

    ngOnInit(): void {
        this.loadLibraries();
    }

    loadLibraries(): void {
        this.loading.set(true);
        this.librariesApi.list().subscribe({
            next: (libraries) => {
                this.libraries.set(libraries);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.toast.error('No se pudieron cargar las bibliotecas');
            },
        });
    }

    register(): void {
        const path = this.rootPath().trim();
        if (!path) {
            this.toast.warning('Escribe la ruta raíz de la biblioteca');
            return;
        }
        this.registering.set(true);
        this.librariesApi.register(path).subscribe({
            next: (library) => {
                this.libraries.set([...this.libraries(), library]);
                this.rootPath.set('');
                this.registering.set(false);
                this.toast.success(`Biblioteca #${library.id} registrada`);
            },
            error: () => {
                this.registering.set(false);
                this.toast.error('No se pudo registrar la biblioteca');
            },
        });
    }

    deleteLibrary(library: Library): void {
        this.librariesApi.delete(library.id).subscribe({
            next: () => {
                this.libraries.set(this.libraries().filter((item) => item.id !== library.id));
                if (this.selected()?.id === library.id) this.selected.set(null);
                this.toast.success(`Biblioteca #${library.id} eliminada`);
            },
            error: () => this.toast.error('No se pudo eliminar la biblioteca'),
        });
    }

    openScan(library: Library): void {
        this.selected.set(library);
        this.selectedAssetIds.set([]);
        this.loadAssets(library.id, 0);
        this.loadCounts(library.id);
    }

    loadAssets(libraryId: number, page: number): void {
        this.loadingAssets.set(true);
        this.librariesApi.scan(libraryId, page, PAGE_SIZE).subscribe({
            next: (result) => {
                this.assets.set(result.items);
                this.assetsTotal.set(result.total);
                this.assetsPage.set(result.page);
                this.assetsTotalPages.set(result.totalPages);
                this.loadingAssets.set(false);
            },
            error: () => {
                this.loadingAssets.set(false);
                this.toast.error('No se pudo escanear la biblioteca');
            },
        });
    }

    private loadCounts(libraryId: number): void {
        this.librariesApi.unidentified(libraryId, 0, 1).subscribe({
            next: (result) => this.unidentifiedCount.set(result.total),
            error: () => this.unidentifiedCount.set(0),
        });
    }

    changePage(offset: number): void {
        const selected = this.selected();
        if (!selected) return;
        const nextPage = this.assetsPage() + offset;
        if (nextPage < 0 || nextPage >= this.assetsTotalPages()) return;
        this.loadAssets(selected.id, nextPage);
    }

    cancelScan(): void {
        const selected = this.selected();
        if (!selected) return;
        this.closeMenus();
        this.librariesApi.cancelScan(selected.id).subscribe({
            next: () => this.toast.info('Escaneo cancelado'),
            error: () => this.toast.error('No se pudo cancelar el escaneo'),
        });
    }

    clearSelection(): void {
        this.selectedAssetIds.set([]);
        this.closeMenus();
    }

    toggleAsset(asset: MediaAsset): void {
        const current = this.selectedAssetIds();
        const next = current.includes(asset.id)
            ? current.filter((id) => id !== asset.id)
            : [...current, asset.id];
        this.selectedAssetIds.set(next);
    }

    toggleSelectAll(): void {
        this.selectedAssetIds.set(
            this.allSelected() ? [] : this.assets().map((asset) => asset.id),
        );
    }

    isSelected(asset: MediaAsset): boolean {
        return this.selectedAssetIds().includes(asset.id);
    }

    private selectedIdentifiedMovieIds(): number[] {
        const selected = new Set(this.selectedAssetIds());
        return this.assets()
            .filter((asset) => selected.has(asset.id) && asset.movieId != null)
            .map((asset) => asset.movieId as number);
    }

    openBulkVisibility(visibility: MovieVisibility): void {
        this.closeMenus();
        const movieIds = this.selectedIdentifiedMovieIds();
        if (!movieIds.length) {
            this.toast.warning('Ningún asset seleccionado está identificado');
            return;
        }
        this.visibilityTarget.set({
            label: `${movieIds.length} película${movieIds.length === 1 ? '' : 's'} seleccionada${movieIds.length === 1 ? '' : 's'}`,
            movieIds,
            initialVisibility: visibility,
        });
    }

    openLibraryVisibility(library: Library): void {
        this.visibilityTarget.set({
            label: `Biblioteca #${library.id} (todas sus películas)`,
            libraryIds: [library.id],
        });
    }

    assetActions(asset: MediaAsset): ActionsMenuItem[] {
        return [
            { label: 'Ver detalles', action: () => this.goToDetails(asset) },
            { label: 'Cambiar estado', action: () => this.openRowVisibility(asset) },
        ];
    }

    openRowVisibility(asset: MediaAsset): void {
        this.closeMenus();
        if (asset.movieId == null) return;
        this.visibilityTarget.set({
            label: `movie #${asset.movieId}`,
            movieIds: [asset.movieId],
        });
    }

    goToDetails(asset: MediaAsset): void {
        this.closeMenus();
        if (asset.movieId == null) return;
        this.router.navigate(['/movies', asset.movieId]);
    }

    onVisibilityClosed(): void {
        this.visibilityTarget.set(null);
    }

    onVisibilityDone(_job: CatalogJob): void {
        this.visibilityTarget.set(null);
        this.selectedAssetIds.set([]);
        this.loadLibraries();
        const selected = this.selected();
        if (selected) {
            this.loadAssets(selected.id, this.assetsPage());
            this.loadCounts(selected.id);
        }
    }

    openIdentify(asset: MediaAsset): void {
        this.identifyTarget.set({ id: asset.id, label: asset.relativePath });
        this.identifyOpen.set(true);
    }

    onIdentified(): void {
        this.identifyOpen.set(false);
        this.identifyTarget.set(null);
        this.toast.success('Asset identificado');
        const selected = this.selected();
        if (selected) {
            this.loadAssets(selected.id, this.assetsPage());
            this.loadCounts(selected.id);
        }
    }

    private closeMenus(): void {
        document.querySelectorAll<HTMLDetailsElement>('details.dropdown[open]').forEach((d) => {
            d.removeAttribute('open');
        });
    }

}
