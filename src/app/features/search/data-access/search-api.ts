import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-base-url';
import { SearchResult } from '@features/search/models/search-result';

@Injectable({ providedIn: 'root' })
export class SearchApi {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = inject(API_BASE_URL);

    search(query: string, limit = 8): Observable<SearchResult[]> {
        return this.http.get<SearchResult[]>(`${this.baseUrl}/web/search`, {
            params: { q: query, limit: String(limit) },
        });
    }
}
