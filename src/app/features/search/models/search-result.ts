import { MediaKind } from '@features/movies/models/media-kind';

export interface SearchResult {
    readonly id: number;
    readonly title: string;
    readonly originalTitle: string | null;
    readonly year: number | null;
    readonly posterUrl: string | null;
    readonly kind: MediaKind;
    readonly status: string;
    readonly playable: boolean;
}
