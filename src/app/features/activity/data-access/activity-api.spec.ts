import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '@core/config/api-base-url';
import { ActivityApi } from './activity-api';

describe('ActivityApi', () => {
    const baseUrl = 'http://bff.test';
    let api: ActivityApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: baseUrl },
            ],
        });
        api = TestBed.inject(ActivityApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('carga la primera página con limit y convierte timestamps', () => {
        let result: unknown;
        api.get().subscribe((page) => (result = page));

        const request = http.expectOne((req) => req.url === `${baseUrl}/web/activity`);
        expect(request.request.method).toBe('GET');
        expect(request.request.params.get('limit')).toBe('20');
        expect(request.request.params.has('cursor')).toBeFalse();
        request.flush({ items: [wire('a')], nextCursor: 'next', hasMore: true });

        expect(result).toEqual(jasmine.objectContaining({ nextCursor: 'next', hasMore: true }));
        expect((result as { items: [{ startedAt: Date }] }).items[0].startedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('envía cursor en páginas posteriores', () => {
        api.get('cursor-1', 20).subscribe();

        const request = http.expectOne((req) => req.url === `${baseUrl}/web/activity`);
        expect(request.request.params.get('cursor')).toBe('cursor-1');
        request.flush({ items: [], nextCursor: null, hasMore: false });
    });
});

function wire(id: string): Record<string, unknown> {
    return {
        activityId: id, correlationId: null, type: 'UPLOAD', status: 'COMPLETED',
        startedAt: '2026-01-01T00:00:00Z', lastOccurredAt: '2026-01-01T00:01:00Z',
        fileName: null, catalogItemId: null, failureCode: null, cursor: id,
        category: 'MEDIA', severity: 'INFO', resourceType: 'MEDIA', resourceId: id,
        resourceTitle: 'Test', context: {},
    };
}
