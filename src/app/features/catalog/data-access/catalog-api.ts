import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-base-url';
import {
    CatalogChangeVisibilityRequest,
    CatalogJob,
    CatalogPage,
    CatalogQueryParams,
} from '@features/catalog/models/catalog';

/** DTO del SSE de activity: el BFF serializa el Job con `id`. */
interface ActivityJobWire {
    id: string;
    status: CatalogJob['status'];
    total: number;
    done: number;
    failed: number;
}

/**
 * Puerta a la experiencia Catalog del BFF. El acceso atómico (single) y el
 * borrado viven en la experiencia media del BFF, pero hoy solo el catálogo
 * los consume; se exponen aquí para no dispersar el estado de esta página.
 */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = inject(API_BASE_URL);

    page(params: CatalogQueryParams): Observable<CatalogPage> {
        return this.http.get<CatalogPage>(`${this.baseUrl}/web/catalog`, {
            params: this.toParams(params),
        });
    }

    /** Acción masiva: encola un job (202) cuyo progreso llega por SSE. */
    changeVisibilityBulk(request: CatalogChangeVisibilityRequest): Observable<CatalogJob> {
        return this.http.post<CatalogJob>(
            `${this.baseUrl}/web/catalog/actions/change-visibility`,
            request,
        );
    }

    /** Acceso atómico de una sola media: PUT /web/media/{id}/access. */
    changeAccess(mediaId: number, visibility: string, sharedWith?: string[]): Observable<unknown> {
        return this.http.put(`${this.baseUrl}/web/media/${mediaId}/access`, {
            visibility,
            sharedWith: sharedWith?.length ? sharedWith : undefined,
        });
    }

    /** Borrado: 204 completado o 202 pendiente de compensación. */
    delete(mediaId: number): Observable<HttpResponse<void>> {
        return this.http.delete<void>(`${this.baseUrl}/web/media/${mediaId}`, {
            observe: 'response',
        });
    }

    /**
     * Progreso del job por SSE (GET /web/activity/{jobId}/events).
     * La sesión viaja por cookie; el wire usa `id`, se mapea a `jobId`.
     */
    jobEvents(jobId: string): Observable<CatalogJob> {
        return new Observable<CatalogJob>((subscriber) => {
            const source = new EventSource(
                `${this.baseUrl}/web/activity/${jobId}/events`,
                { withCredentials: true },
            );

            source.onmessage = (event) => {
                const job = JSON.parse(event.data) as ActivityJobWire;
                subscriber.next({
                    jobId: job.id,
                    status: job.status,
                    total: job.total,
                    done: job.done,
                    failed: job.failed,
                });
                if (job.status === 'COMPLETED' || job.status === 'FAILED') {
                    source.close();
                    subscriber.complete();
                }
            };

            source.onerror = () => {
                source.close();
                subscriber.error(new Error('Conexión del progreso perdida'));
            };

            return () => source.close();
        });
    }

    private toParams(params: CatalogQueryParams): Record<string, string> {
        const result: Record<string, string> = {
            page: String(params.page),
            size: String(params.size),
        };
        if (params.q?.trim()) result['q'] = params.q.trim();
        if (params.status && params.status !== 'ALL') result['status'] = params.status;
        if (params.sort) result['sort'] = params.sort;
        if (params.dir) result['dir'] = params.dir;
        return result;
    }
}
