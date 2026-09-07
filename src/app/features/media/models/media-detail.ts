import { MediaKind } from '@features/movies/models/media-kind';

export interface MediaDetail {
    readonly overview: MediaOverview;
    readonly media: MediaSummary;
    readonly access: MediaAccess;
    readonly provider: MediaProvider;
    readonly capabilities: MediaCapabilities;
}

export interface MediaOverview {
    readonly title: string;
    readonly originalTitle: string | null;
    readonly year: number | null;
    readonly duration: string | null;
    readonly posterUrl: string | null;
    readonly overview: string | null;
    readonly genres: string[];
    readonly director: string | null;
    readonly cast: string[];
}

export interface MediaSummary {
    readonly mediaId: number;
    readonly status: string;
    readonly displayStatus: string;
    readonly kind: MediaKind;
    readonly visibility: string | null;
}

export interface MediaAccess {
    readonly source: string;
    readonly assetId: number | null;
    readonly assetPresent: boolean | null;
}

export interface MediaProvider {
    readonly status: string;
    readonly providerId: number | null;
}

export interface MediaCapabilities {
    readonly play: boolean;
    readonly viewDetail: boolean;
    readonly editMetadata: boolean;
    readonly changeVisibility: boolean;
    readonly manageSharing: boolean;
    readonly linkProvider: boolean;
    readonly unlinkProvider: boolean;
    readonly identify: boolean;
    readonly delete: boolean;
}

export interface MediaMetadataUpdate {
    readonly title?: string;
    readonly originalTitle?: string | null;
    readonly year?: number | null;
    readonly genres?: string[];
    readonly duration?: string | null;
    readonly director?: string | null;
    readonly cast?: string[];
    readonly overview?: string | null;
    readonly posterUrl?: string | null;
    readonly releaseDate?: string | null;
    readonly country?: string | null;
    readonly language?: string | null;
    readonly awards?: string[];
    readonly popularity?: number | null;
    readonly kind?: MediaKind;
}

export interface MediaAccessUpdate {
    readonly visibility: string;
    readonly sharedWith: string[];
}

export interface MediaProviderLink {
    readonly tmdbId: number;
}
