import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Campana de actividad del shell. V1: sin centro de notificaciones;
 * lleva a la página de actividad donde se ven subidas y trabajos.
 */
@Component({
    selector: 'app-notification-button',
    imports: [],
    template: `
        <button class="bell" type="button" (click)="openActivity()" aria-label="Actividad">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            @if (count() > 0) {
                <span class="badge">{{ count() }}</span>
            }
        </button>
    `,
    styles: `
        .bell {
            position: relative;
            display: grid;
            place-items: center;
            width: 34px;
            height: 34px;
            border: none;
            border-radius: 8px;
            background: none;
            color: #92929e;
            cursor: pointer;
            transition: color 0.2s ease, background 0.2s ease;
        }

        .bell:hover { color: #e4e4ec; background: rgba(255, 255, 255, 0.06); }

        .badge {
            position: absolute;
            top: 2px;
            right: 2px;
            min-width: 0.95rem;
            height: 0.95rem;
            padding: 0 0.22rem;
            border-radius: 999px;
            background: #ff3d00;
            color: #fff;
            font-size: 0.62rem;
            font-weight: 700;
            line-height: 0.95rem;
            text-align: center;
        }
    `,
})
export class NotificationButton {
    private readonly router = inject(Router);

    /** Operaciones en curso relevantes (p. ej. subidas activas). */
    readonly count = input(0);

    openActivity(): void {
        this.router.navigate(['/activity']);
    }
}
