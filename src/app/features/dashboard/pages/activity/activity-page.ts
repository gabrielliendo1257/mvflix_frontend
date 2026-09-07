import { Component, inject } from '@angular/core';
import { UploadFacade } from '@features/uploads/services/upload-facade';
import { ActivityStore } from '@features/activity/data-access/activity-store';
import { ActivityItem } from '@features/activity/models/activity';

@Component({
    selector: 'app-activity-page',
    imports: [],
    providers: [ActivityStore],
    templateUrl: './activity-page.html',
    styleUrl: './activity-page.css',
})
export class ActivityPage {
    private readonly uploadFacade = inject(UploadFacade);
    readonly activityStore = inject(ActivityStore);

    readonly uploads = this.uploadFacade.tasks;

    constructor() {
        this.activityStore.load();
    }

    uploadLabel(state: string): string {
        if (state === 'completed') return 'COMPLETED';
        if (state === 'failed') return 'FAILED';
        if (state === 'cancelled') return 'CANCELLED';
        return 'RUNNING';
    }

    activityLabel(activity: ActivityItem): string {
        return activity.resourceTitle || activity.fileName || activity.type;
    }

    formatActivityDate(value: Date): string {
        return value.toLocaleString();
    }
}
