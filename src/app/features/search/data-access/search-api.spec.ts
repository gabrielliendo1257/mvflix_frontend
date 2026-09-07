import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '@core/config/api-base-url';
import { SearchApi } from './search-api';

describe('SearchApi', () => {
    const baseUrl = 'http://bff.test';
    let api: SearchApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: baseUrl }],
        });
        api = TestBed.inject(SearchApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('consume la proyección dedicada con q y limit', () => {
        let result: unknown;
        api.search('alien', 8).subscribe((value) => (result = value));

        const request = http.expectOne((req) => req.url === `${baseUrl}/web/search`);
        expect(request.request.method).toBe('GET');
        expect(request.request.params.get('q')).toBe('alien');
        expect(request.request.params.get('limit')).toBe('8');
        request.flush([{ id: 1, title: 'Alien', originalTitle: null, year: 1979, posterUrl: null, kind: 'MOVIE', status: 'READY', playable: true }]);

        expect(result).toEqual([{ id: 1, title: 'Alien', originalTitle: null, year: 1979, posterUrl: null, kind: 'MOVIE', status: 'READY', playable: true }]);
    });
});
