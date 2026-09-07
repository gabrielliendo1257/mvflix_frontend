import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '@core/config/api-base-url';
import { MediaApi } from './media-api';

describe('MediaApi', () => {
    const baseUrl = 'http://bff.test';
    let api: MediaApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: baseUrl },
            ],
        });
        api = TestBed.inject(MediaApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('carga el detalle camelCase incluyendo capabilities', () => {
        let response: unknown;
        api.detail(42).subscribe((value) => (response = value));

        const request = http.expectOne(`${baseUrl}/web/media/42`);
        expect(request.request.method).toBe('GET');
        request.flush(detailWire());

        expect(response).toEqual(jasmine.objectContaining({
            media: jasmine.objectContaining({ mediaId: 42, displayStatus: 'READY', kind: 'MOVIE' }),
            capabilities: jasmine.objectContaining({ play: true, editMetadata: true, delete: true }),
        }));
    });

    it('envía los parches de metadata y access en camelCase', () => {
        const metadata = { title: 'Updated', posterUrl: null, releaseDate: '2026-01-01', kind: 'VIDEO' as const };
        const access = { visibility: 'SHARED', sharedWith: ['alice'] };

        api.updateMetadata(42, metadata).subscribe();
        const metadataRequest = http.expectOne(`${baseUrl}/web/media/42/metadata`);
        expect(metadataRequest.request.method).toBe('PUT');
        expect(metadataRequest.request.body).toEqual(metadata);
        metadataRequest.flush(detailWire());

        api.updateAccess(42, access).subscribe();
        const accessRequest = http.expectOne(`${baseUrl}/web/media/42/access`);
        expect(accessRequest.request.method).toBe('PUT');
        expect(accessRequest.request.body).toEqual(access);
        accessRequest.flush(detailWire());
    });

    it('gestiona link/unlink provider y delete media', () => {
        api.linkProvider(42, { tmdbId: 550 }).subscribe();
        const link = http.expectOne(`${baseUrl}/web/media/42/provider`);
        expect(link.request.method).toBe('POST');
        expect(link.request.body).toEqual({ tmdbId: 550 });
        link.flush(detailWire());

        api.unlinkProvider(42).subscribe();
        const unlink = http.expectOne(`${baseUrl}/web/media/42/provider`);
        expect(unlink.request.method).toBe('DELETE');
        unlink.flush(detailWire());

        api.deleteMedia(42).subscribe();
        const deletion = http.expectOne(`${baseUrl}/web/media/42`);
        expect(deletion.request.method).toBe('DELETE');
        deletion.flush(null, { status: 204, statusText: 'No Content' });
    });
});

function detailWire(): Record<string, unknown> {
    return {
        overview: {
            title: 'Fight Club', originalTitle: 'Fight Club', year: 1999,
            duration: '2h 19m', posterUrl: null, overview: 'Overview', genres: ['Drama'],
            director: 'David Fincher', cast: ['Brad Pitt'],
        },
        media: { mediaId: 42, status: 'READY', displayStatus: 'READY', kind: 'MOVIE', visibility: 'PRIVATE' },
        access: { source: 'MANAGED', assetId: 7, assetPresent: true },
        provider: { status: 'LINKED', providerId: 550 },
        capabilities: {
            play: true, viewDetail: true, editMetadata: true, changeVisibility: true,
            manageSharing: true, linkProvider: false, unlinkProvider: true, identify: false, delete: true,
        },
    };
}
