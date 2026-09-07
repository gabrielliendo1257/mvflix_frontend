import { Component, computed, inject, signal } from '@angular/core';
import { HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/session/auth.service';
import { ShellStore } from '@features/shell/data-access/shell-store';
import { ShellQuota } from '@features/shell/models/shell-context';
import { BytesPipe } from '@shared/pipes/bytes.pipe';
import { ShellAccess } from '@layout/access';

/**
 * Contexto del usuario del shell: avatar + menú (Profile, Settings,
 * Admin Dashboard si aplica, Sign out). Sin sesión: Sign in / Sign up.
 */
@Component({
    selector: 'app-user-menu',
    imports: [RouterLink],
    template: `
        @if (access.isAuthenticated()) {
            <div class="user-menu">
                <button class="user-trigger" type="button" (click)="menuOpen.set(!menuOpen())"
                        [attr.aria-expanded]="menuOpen()" aria-label="Menú de usuario">
                    @if (avatarUrl(); as src) {
                        <img class="avatar avatar-img" [src]="src" alt=""
                             (error)="avatarFailed.set(true)" />
                    } @else if (initial(); as letter) {
                        <span class="avatar">{{ letter }}</span>
                    }
                    <span class="username">{{ username() }}</span>
                    <svg class="chevron" [class.open]="menuOpen()" width="11" height="11"
                         viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                         aria-hidden="true">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>

                @if (menuOpen()) {
                    <div class="dropdown" role="menu">
                        @if (email(); as mail) {
                            <div class="dropdown-header">{{ mail }}</div>
                        }

                        <!-- Cuota: en móvil/tablet vive aquí; el pill del navbar se oculta por espacio. -->
                        @if (quota(); as q) {
                            <a class="quota-row" routerLink="/dashboard/settings" (click)="close()"
                               [attr.aria-label]="'Almacenamiento: ' + quotaDetail(q)">
                                <span class="quota-line">
                                    <span class="quota-label">Storage</span>
                                    <span class="quota-pct" [class.danger]="nearLimit(q)">{{ q.usedPercent }}%</span>
                                </span>
                                <span class="quota-track" aria-hidden="true">
                                    <span class="quota-fill"
                                          [class.danger]="nearLimit(q)"
                                          [style.width.%]="q.usedPercent"></span>
                                </span>
                                <span class="quota-detail">{{ quotaDetail(q) }}</span>
                            </a>
                        }

                        <a class="dropdown-item" role="menuitem" routerLink="/account"
                           (click)="close()">
                            Profile
                        </a>
                        <a class="dropdown-item" role="menuitem" routerLink="/dashboard/settings"
                           (click)="close()">
                            Settings
                        </a>
                        <a class="dropdown-item" role="menuitem" routerLink="/activity"
                           (click)="close()">
                            Activity
                        </a>

                        @if (access.canAccessAdmin()) {
                            <div class="dropdown-divider"></div>
                            <a class="dropdown-item" role="menuitem" routerLink="/dashboard"
                               (click)="close()">
                                Admin Dashboard
                            </a>
                        }

                        <div class="dropdown-divider"></div>
                        <button class="dropdown-item danger" type="button" role="menuitem"
                                (click)="signOut(); close()">
                            Sign out
                        </button>
                    </div>
                }
            </div>
        } @else {
            <div class="auth-actions">
                <button class="btn-ghost" type="button" (click)="signIn()">Sign in</button>
                <button class="btn-primary" type="button" (click)="signUp()">Sign up</button>
            </div>
        }
    `,
    styles: `
        .user-menu { position: relative; }

        .user-trigger {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border: none;
            background: none;
            color: #e4e4ec;
            font-size: 0.82rem;
            font-weight: 500;
            cursor: pointer;
            padding: 0.25rem 0.4rem;
            border-radius: 8px;
        }

        .user-trigger:hover { background: rgba(255, 255, 255, 0.06); }

        .avatar {
            display: grid;
            place-items: center;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff3d00, #ff6d3f);
            color: #fff;
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        .avatar-img { object-fit: cover; }

        .chevron { color: #92929e; transition: transform 0.2s ease; }
        .chevron.open { transform: rotate(180deg); }

        .dropdown {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            min-width: 200px;
            padding: 0.4rem;
            border-radius: 10px;
            background: #14141b;
            border: 1px solid #26262f;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
            z-index: 120;
        }

        .dropdown-header {
            padding: 0.45rem 0.6rem 0.55rem;
            font-size: 0.72rem;
            color: #6d6d7a;
            border-bottom: 1px solid #1e1e26;
            margin-bottom: 0.3rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* Cuota dentro del menú (visible también en móvil). */
        .quota-row {
            display: block;
            margin: 0.15rem 0.2rem 0.35rem;
            padding: 0.5rem 0.6rem;
            border: 1px solid #26262f;
            border-radius: 8px;
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
            font-size: 0.72rem;
            font-weight: 700;
            color: #ff6d3f;
            font-variant-numeric: tabular-nums;
        }

        .quota-pct.danger { color: #ff6d5e; }

        .quota-track {
            display: block;
            height: 4px;
            margin: 0.3rem 0 0.25rem;
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
            font-size: 0.68rem;
            color: #6d6d7a;
            font-variant-numeric: tabular-nums;
        }

        .dropdown-item {
            display: block;
            width: 100%;
            padding: 0.5rem 0.6rem;
            border: none;
            border-radius: 7px;
            background: none;
            color: #c9c9d4;
            font-size: 0.8rem;
            text-align: left;
            text-decoration: none;
            cursor: pointer;
        }

        .dropdown-item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
        .dropdown-item.danger { color: #ff6d5e; }
        .dropdown-divider { height: 1px; margin: 0.3rem 0.2rem; background: #1e1e26; }

        .auth-actions { display: flex; align-items: center; gap: 0.5rem; }

        .btn-ghost {
            border: none;
            background: none;
            color: #c9c9d4;
            font-size: 0.82rem;
            font-weight: 500;
            padding: 0.4rem 0.75rem;
            border-radius: 8px;
            cursor: pointer;
        }

        .btn-ghost:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }

        .btn-primary {
            border: none;
            background: linear-gradient(135deg, #ff3d00, #ff6d3f);
            color: #fff;
            font-size: 0.82rem;
            font-weight: 600;
            padding: 0.45rem 0.9rem;
            border-radius: 8px;
            cursor: pointer;
        }

        .btn-primary:hover { filter: brightness(1.12); }

        @media (max-width: 767px) {
            .username, .chevron { display: none; }
        }
    `,
})
export class UserMenu {
    private readonly auth = inject(AuthService);
    private readonly shell = inject(ShellStore);
    readonly access = inject(ShellAccess);

    private readonly bytes = new BytesPipe();

    readonly menuOpen = signal(false);

    /** Avatar roto → fallback a iniciales sin recargar nada. */
    readonly avatarFailed = signal(false);

    readonly profile = this.shell.user;
    readonly quota = this.shell.quota;

    readonly username = computed(() => {
        const user = this.profile();
        return user?.displayName ?? user?.username ?? '';
    });
    readonly email = computed(() => this.profile()?.email ?? null);
    readonly avatarUrl = computed(() => {
        if (this.avatarFailed()) return null;
        return this.profile()?.avatarUrl ?? null;
    });
    readonly initial = computed(() => {
        const name = this.username().trim() || this.profile()?.username || '';
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
        this.auth.logout();
    }

    close(): void {
        // El routerLink ya navegó; el menú se cierra tras la interacción.
        this.menuOpen.set(false);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-menu')) {
            this.menuOpen.set(false);
        }
    }
}
