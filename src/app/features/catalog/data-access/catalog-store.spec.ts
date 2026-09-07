import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_BASE_URL } from '@core/config/api-base-url';
import { CatalogStore } from './catalog-store';
import { CatalogApi } from './catalog-api';
import { CatalogItem, CatalogPage } from '@features/catalog/models/catalog';

function item(overrides: Partial<CatalogItem> = {}): CatalogItem {
    return {
        key: { type: 'MEDIA', id: 1 },
        mediaId: 1,
        assetId: null,
        assetPresent: null,
        title: 'Dune',
        posterUrl: null,
        year: 2024,
        duration: null,
        kind: 'MOVIE',
        status: 'READY',
        displayStatus: 'READY',
        source: 'MANAGED',
        visibility: 'PRIVATE',
        sharedWithCount: 0,
        providerStatus: null,
        capabilities: {
            play: true,
            viewDetail: true,
            editMetadata: true,
            changeVisibility: true,
            manageSharing: true,
            linkProvider: true,
            unlinkProvider: false,
            identify: false,
            delete: true,
        },
        ...overrides,
    };
}

function page(overrides: Partial<CatalogPage> = {}): CatalogPage {
    return {
        summary: { total: 1, ready: 1, needsAttention: 0 },
        items: [item()],
        page: 0,
        size: 25,
        total: 1,
        totalPages: 1,
        ...overrides,
    };
}

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

describe('CatalogStore', () => {
    let http: HttpTestingController;
    let baseUrl: string;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        http = TestBed.inject(HttpTestingController);
        baseUrl = TestBed.inject(API_BASE_URL);
    });

    afterEach(() => http.verify());

    it('carga la primera página con los parámetros del servidor', () => {
        const store = TestBed.inject(CatalogStore);

        store.load(0);
        const request = http.expectOne(
            (req) => req.url === `${baseUrl}/web/catalog` && req.params.get('page') === '0',
        );
        expect(request.request.params.get('sort')).toBe('updated');
        request.flush(page());

        expect(store.items().length).toBe(1);
        expect(store.summary().ready).toBe(1);
        expect(store.loading()).toBeFalse();
    });

    it('envía q y status al servidor y reanuda la página en 0', async () => {
        const store = TestBed.inject(CatalogStore);
        store.load(0);
        http.expectOne(
            (req) => req.url === `${baseUrl}/web/catalog` && req.params.get('page') === '0',
        ).flush(page());

        store.setQuery('dune');
        // el debounce del texto es de 300ms
        await new Promise(resolve => setTimeout(resolve, 350));

        const request = http.expectOne(
            (req) => req.params.get('q') === 'dune' && req.params.get('page') === '0',
        );
        expect(request.request.params.get('status')).toBeNull();
        request.flush(page());
    });

    it('la selección solo incluye filas MEDIA para la acción masiva', () => {
        const store = TestBed.inject(CatalogStore);
        const media = item();
        const asset = item({
            key: { type: 'ASSET', id: 9 },
            mediaId: null,
            assetId: 9,
            assetPresent: true,
            title: 'video.mp4',
            displayStatus: 'UNIDENTIFIED',
            status: 'UNIDENTIFIED',
            capabilities: {
                play: false,
                viewDetail: false,
                editMetadata: false,
                changeVisibility: false,
                manageSharing: false,
                linkProvider: false,
                unlinkProvider: false,
                identify: true,
                delete: false,
            },
        });

        store.load(0);
        http.expectOne(
            (req) => req.url === `${baseUrl}/web/catalog` && req.params.get('page') === '0',
        ).flush(page({ items: [media, asset] }));

        expect(store.selectableItems().length).toBe(1);
        expect(store.isSelected(asset)).toBeFalse();
    });

    it('conserva el status HTTP del borrado para distinguir 204 y 202', () => {
        const api = TestBed.inject(CatalogApi);
        let status = 0;

        api.delete(1).subscribe((response) => (status = response.status));
        http.expectOne(`${baseUrl}/web/media/1`).flush(null, { status: 202, statusText: 'Accepted' });
        expect(status).toBe(202);

        api.delete(1).subscribe((response) => (status = response.status));
        http.expectOne(`${baseUrl}/web/media/1`).flush(null, { status: 204, statusText: 'No Content' });
        expect(status).toBe(204);
    });
});
