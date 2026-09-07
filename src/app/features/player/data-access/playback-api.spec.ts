import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '@core/config/api-base-url';
import { PlaybackApi } from './playback-api';

describe('PlaybackApi', () => {
    const baseUrl = 'http://bff.test';
    let api: PlaybackApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: baseUrl },
            ],
        });
        api = TestBed.inject(PlaybackApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('envía el progreso a la sesión y mapea la respuesta', () => {
        const progress = {
            sequence: 8,
            positionSeconds: 121,
            durationSeconds: 3600,
            completed: false,
        };
        let response: unknown;

        api.recordProgress('session-1', progress).subscribe((value) => (response = value));

        const request = http.expectOne(`${baseUrl}/web/playback/sessions/session-1/progress`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(progress);
        request.flush({ sequence: 8, positionSeconds: 121, status: 'RECORDED' });

        expect(response).toEqual({ sequence: 8, positionSeconds: 121, status: 'RECORDED' });
    });

    it('admite durationSeconds null y posición null en la respuesta', () => {
        const progress = {
            sequence: 9,
            positionSeconds: 3600,
            durationSeconds: null,
            completed: true,
        };
        let response: unknown;

        api.recordProgress('session-2', progress).subscribe((value) => (response = value));
        const request = http.expectOne(`${baseUrl}/web/playback/sessions/session-2/progress`);
        expect(request.request.body).toEqual(progress);
        request.flush({ sequence: 9, positionSeconds: null, status: 'COMPLETED' });

        expect(response).toEqual({ sequence: 9, positionSeconds: null, status: 'COMPLETED' });
    });
});
