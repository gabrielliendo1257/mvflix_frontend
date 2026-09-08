import { MovieMetadata } from './movie-metadata';

/** Candidato externo seleccionado para enriquecer una media. */
export interface ProviderCandidate extends MovieMetadata {
    readonly id: number;
}
