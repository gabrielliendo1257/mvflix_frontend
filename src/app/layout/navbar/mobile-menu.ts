import { Component, computed, inject, input, signal } from '@angular/core';
import { HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/session/auth.service';
import { ShellStore } from '@features/shell/data-access/shell-store';
import { ShellQuota } from '@features/shell/models/shell-context';
import { BytesPipe } from '@shared/pipes/bytes.pipe';
import { ShellAccess } from '@layout/access';
import { NavIcon, NavIconName } from '@layout/navbar/nav-icon';
import { DESTINATIONS } from '@layout/navbar/primary-navigation';

/**
 * Menú lateral del shell en móvil y tablet (<1024px): la misma información
 * que el navbar de desktop (identidad, cuota, destinos, cuenta) en un drawer.
 * En desktop la barra inline ya lo cubre y el burger no existe.
 */
@Component({
    selector: 'app-mobile-menu',
    imports: [RouterLink, NavIcon],
    template: `
        <button class="burger" type="button" (click)="open.set(!open())"
                [attr.aria-expanded]="open()" aria-label="Abrir menú"
                aria-controls="shell-drawer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true">
                @if (open()) {
                    <line x1="5" y1="5" x2="19" y2="19"/>
                    <line x1="19" y1="5" x2="5" y2="19"/>
                } @else {
                    <line x1="4" y1="7" x2="20" y2="7"/>
                    <line x1="4" y1="12" x2="20" y2="12"/>
                    <line x1="4" y1="17" x2="20" y2="17"/>
                }
            </svg>
        </button>

        @if (open()) {
            <div class="backdrop" (click)="close()" aria-hidden="true"></div>

            <aside id="shell-drawer" class="drawer" role="dialog" aria-modal="true"
                   aria-label="Menú de la aplicación">
                <!-- Identidad o invitación -->
                @if (access.isAuthenticated()) {
                    <header class="identity row">
                        @if (avatarUrl(); as src) {
                            <img class="avatar avatar-img" [src]="src" alt="" (error)="avatarBroken.set(true)"/>
                        } @else if (initial(); as letter) {
                            <span class="avatar">{{ letter }}</span>
                        }
                        <span class="who">
                            <span class="name">{{ displayName() }}</span>
                            @if (email(); as mail) {
                                <span class="mail">{{ mail }}</span>
                            }
                        </span>
                    </header>

                    @if (quota(); as q) {
                        <a class="quota-row" routerLink="/dashboard/settings" (click)="close()"
                           [attr.aria-label]="'Almacenamiento: ' + quotaDetail(q)">
                            <span class="quota-line">
                                <span class="quota-label">Storage</span>
                                <span class="quota-pct" [class.danger]="nearLimit(q)">{{ q.usedPercent }}%</span>
                            </span>
                            <span class="quota-track" aria-hidden="true">
                                <span class="quota-fill" [class.danger]="nearLimit(q)"
                                      [style.width.%]="q.usedPercent"></span>
                            </span>
                            <span class="quota-detail">{{ quotaDetail(q) }}</span>
                        </a>
                    }
                } @else {
                    <header class="identity">
                        <span class="welcome">Bienvenido a MVFLIX</span>
                        <p class="hint">Inicia sesión para añadir contenido y gestionar tus bibliotecas.</p>
                        <div class="auth-stack">
                            <button class="btn-drawer primary" type="button" (click)="signIn()">Sign in</button>
                            <button class="btn-drawer" type="button" (click)="signUp()">Sign up</button>
                        </div>
                    </header>
                }

                <!-- Destinos globales (los mismos del desktop) -->
                <nav class="section" aria-label="Destinos">
                    @for (destination of destinations; track destination.route) {
                        <a class="item" [routerLink]="destination.route" (click)="close()">
                            <app-nav-icon [name]="destination.icon" />
                            {{ destination.label }}
                        </a>
                    }
                </nav>

                <!-- Cuenta -->
                @if (access.isAuthenticated()) {
                    <nav class="section" aria-label="Cuenta">
                        <a class="item" routerLink="/account" (click)="close()">
                            <app-nav-icon name="profile" /> Profile
                        </a>
                        <a class="item" routerLink="/dashboard/settings" (click)="close()">
                            <app-nav-icon name="settings" /> Settings
                        </a>
                        <a class="item" routerLink="/activity" (click)="close()">
                            <app-nav-icon name="activity" /> Activity
                        </a>
                        @if (access.canAccessAdmin()) {
                            <a class="item" routerLink="/dashboard" (click)="close()">
                                <app-nav-icon name="admin" /> Admin Dashboard
                            </a>
                        }
                    </nav>

                    <button class="btn-drawer danger" type="button" (click)="signOut()">Sign out</button>
                }
            </aside>
        }
    `,
    styles: `
        .burger {
            display: none;
            place-items: center;
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 8px;
            background: none;
            color: #e4e4ec;
            cursor: pointer;
        }

        .burger:hover { background: rgba(255, 255, 255, 0.06); }

        .backdrop {
            position: fixed;
            inset: 0;
            z-index: 200;
            background: rgba(0, 0, 0, 0.6);
        }

        .drawer {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 210;
            display: flex;
            flex-direction: column;
            gap: 0.9rem;
            width: min(320px, 86vw);
            padding: 1rem 0.85rem calc(1rem + env(safe-area-inset-bottom));
            overflow-y: auto;
            background: #14141b;
            border-left: 1px solid #26262f;
            box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
            animation: drawer-in 0.22s ease;
        }

        @keyframes drawer-in {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }

        .identity {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            padding-bottom: 0.85rem;
            border-bottom: 1px solid #1e1e26;
        }

        .identity.row {
            flex-direction: row;
            align-items: center;
        }

        .avatar {
            display: grid;
            place-items: center;
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff3d00, #ff6d3f);
            color: #fff;
            font-size: 0.95rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        .avatar-img { object-fit: cover; }

        .who {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .name {
            color: #e4e4ec;
            font-size: 0.92rem;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mail,
        .hint {
            margin: 0;
            color: #6d6d7a;
            font-size: 0.75rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .welcome { color: #e4e4ec; font-size: 0.95rem; font-weight: 700; }
        .hint { white-space: normal; line-height: 1.45; }

        .auth-stack {
            display: grid;
            gap: 0.5rem;
        }

        /* Mismo lenguaje que los botones del tema */
        .btn-drawer {
            padding: 0.6rem 0.95rem;
            border-radius: 8px;
            border: 1px solid #26262f;
            background: rgba(255, 255, 255, 0.05);
            color: #e4e4ec;
            font-size: 0.88rem;
            font-weight: 500;
            cursor: pointer;
        }

        .btn-drawer:hover { background: rgba(255, 255, 255, 0.1); }

        .btn-drawer.primary {
            border-color: transparent;
            background: linear-gradient(135deg, #ff3d00, #ff6d3f);
            color: #fff;
            font-weight: 600;
        }

        .btn-drawer.primary:hover { filter: brightness(1.12); background: linear-gradient(135deg, #ff3d00, #ff6d3f); }

        .btn-drawer.danger {
            margin-top: auto;
            border-color: rgba(255, 109, 94, 0.35);
            background: none;
            color: #ff6d5e;
        }

        .btn-drawer.danger:hover { background: rgba(255, 109, 94, 0.12); }

        .section {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
        }

        .item {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            padding: 0.65rem 0.6rem;
            border-radius: 8px;
            color: #c9c9d4;
            font-size: 0.9rem;
            text-decoration: none;
        }

        .item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }

        .item app-nav-icon { color: #92929e; flex-shrink: 0; }
        .item:hover app-nav-icon { color: currentColor; }

        /* Cuota: mismo bloque que el dropdown de usuario */
        .quota-row {
            display: block;
            padding: 0.6rem 0.7rem;
            border: 1px solid #26262f;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
            text-decoration: none;
        }

        .quota-row:hover { background: rgba(255, 255, 255, 0.06); }

        .quota-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
        }

        .quota-label {
            font-size: 0.66rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #92929e;
        }

        .quota-pct {
            font-size: 0.78rem;
            font-weight: 700;
            color: #ff6d3f;
            font-variant-numeric: tabular-nums;
        }

        .quota-pct.danger { color: #ff6d5e; }

        .quota-track {
            display: block;
            height: 4px;
            margin: 0.35rem 0 0.3rem;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.1);
            overflow: hidden;
        }

        .quota-fill {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: #ff6d3f;
        }

        .quota-fill.danger { background: #ff6d5e; }

        .quota-detail {
            display: block;
            font-size: 0.72rem;
            color: #6d6d7a;
            font-variant-numeric: tabular-nums;
        }

        /* Móvil y tablet (<1024px); desktop mantiene la barra inline completa. */
        @media (max-width: 1023px) {
            .burger { display: grid; }
        }
    `,
})
export class MobileMenu {
    private readonly auth = inject(AuthService);
    private readonly shell = inject(ShellStore);
    readonly access = inject(ShellAccess);

    private readonly bytes = new BytesPipe();

    readonly open = signal(false);
    readonly destinations = DESTINATIONS;

    /** Avatar roto → fallback a iniciales sin recargar nada. */
    readonly avatarBroken = signal(false);

    readonly profile = this.shell.user;
    readonly quota = this.shell.quota;

    readonly displayName = computed(() => this.profile()?.displayName ?? this.profile()?.username ?? '');
    readonly email = computed(() => this.profile()?.email ?? null);
    readonly avatarUrl = computed(() => (this.avatarBroken() ? null : this.profile()?.avatarUrl ?? null));
    readonly initial = computed(() => {
        const name = this.displayName().trim() || this.profile()?.username || '';
        return name ? name[0] : null;
    });

    quotaDetail(quota: ShellQuota): string {
        return `${this.bytes.transform(quota.usedBytes)} de ${this.bytes.transform(quota.limitBytes)} · ${quota.usedPercent}%`;
    }

    nearLimit(quota: ShellQuota): boolean {
        return (quota.usedPercent ?? 0) >= 90;
    }

    signIn(): void {
        this.auth.startLoginFlow();
    }

    // TODO(signup): apuntar al flujo de registro cuando el BFF exponga uno distinto del login OAuth2.
    signUp(): void {
        this.auth.startLoginFlow();
    }

    signOut(): void {
        this.close();
        this.auth.logout();
    }

    close(): void {
        this.open.set(false);
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        this.close();
    }
}
